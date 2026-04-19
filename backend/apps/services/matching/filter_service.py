from __future__ import annotations

import math

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import (
    Case,
    Exists,
    F,
    FloatField,
    IntegerField,
    OuterRef,
    Q,
    QuerySet,
    Value,
    When,
)
from django.db.models.functions import ACos, Cast, Cos, Greatest, Least, Radians, Sin

from apps.matching.models import Match, Swipe

User = get_user_model()

EARTH_RADIUS_KM = 6371.0088
DEFAULT_RADIUS_KM = 50.0
MIN_LIMIT = 100
MAX_LIMIT = 1000


def _safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalized_limit(limit: int | None) -> int:
    if limit is None:
        return MAX_LIMIT
    try:
        parsed = int(limit)
    except (TypeError, ValueError):
        parsed = MAX_LIMIT
    return max(MIN_LIMIT, min(parsed, MAX_LIMIT))


def _preferred_gender_values(preference: str | None) -> tuple[str, ...] | None:
    normalized = (preference or "").strip().lower()
    if normalized == "everyone":
        return None
    if normalized in {"male", "female"}:
        return (normalized,)
    return None


def _compatible_gender_queryset(user) -> QuerySet:
    queryset = User.objects.exclude(pk=user.pk)

    preferred = _preferred_gender_values(getattr(user, "preference", None))
    if preferred is not None:
        queryset = queryset.filter(gender__in=preferred)

    user_gender = str(getattr(user, "gender", "") or "").strip().lower()
    if user_gender in {"male", "female"}:
        queryset = queryset.filter(Q(preference="everyone") | Q(preference=user_gender))
    else:
        queryset = queryset.filter(preference="everyone")

    return queryset


def _exclude_swiped_and_matched(queryset: QuerySet, user) -> QuerySet:
    swiped_subquery = Swipe.objects.filter(
        user_id=user.id,
        target_user_id=OuterRef("pk"),
    )
    matched_subquery = Match.objects.filter(
        (Q(user_a_id=user.id) & Q(user_b_id=OuterRef("pk")))
        | (Q(user_b_id=user.id) & Q(user_a_id=OuterRef("pk")))
    )
    return queryset.annotate(
        _already_swiped=Exists(swiped_subquery),
        _already_matched=Exists(matched_subquery),
    ).filter(
        _already_swiped=False,
        _already_matched=False,
    )


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    d_lat = lat2_rad - lat1_rad
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _apply_bounding_box(queryset: QuerySet, lat: float, lon: float, radius_km: float) -> QuerySet:
    lat_delta = radius_km / 111.0
    min_lat = max(-90.0, lat - lat_delta)
    max_lat = min(90.0, lat + lat_delta)
    queryset = queryset.filter(latitude__gte=min_lat, latitude__lte=max_lat)

    cos_lat = max(abs(math.cos(math.radians(lat))), 0.01)
    lon_delta = radius_km / (111.320 * cos_lat)
    min_lon = lon - lon_delta
    max_lon = lon + lon_delta

    if min_lon < -180.0:
        queryset = queryset.filter(Q(longitude__gte=min_lon + 360.0) | Q(longitude__lte=max_lon))
    elif max_lon > 180.0:
        queryset = queryset.filter(Q(longitude__gte=min_lon) | Q(longitude__lte=max_lon - 360.0))
    else:
        queryset = queryset.filter(longitude__gte=min_lon, longitude__lte=max_lon)

    return queryset


def _distance_ordered_postgres_queryset(
    queryset: QuerySet,
    *,
    lat: float,
    lon: float,
    radius_km: float,
    limit: int,
) -> QuerySet:
    latitude = Cast(F("latitude"), FloatField())
    longitude = Cast(F("longitude"), FloatField())

    cosine_argument = (
        Sin(Radians(Value(lat))) * Sin(Radians(latitude))
        + Cos(Radians(Value(lat))) * Cos(Radians(latitude)) * Cos(Radians(longitude) - Radians(Value(lon)))
    )
    clamped = Greatest(Value(-1.0), Least(Value(1.0), cosine_argument))
    distance_expr = Value(EARTH_RADIUS_KM) * ACos(clamped)

    return (
        queryset.annotate(distance_km=distance_expr)
        .filter(distance_km__lte=radius_km)
        .order_by("distance_km", "id")[:limit]
    )


def _distance_ordered_fallback_queryset(
    queryset: QuerySet,
    *,
    lat: float,
    lon: float,
    radius_km: float,
    limit: int,
) -> QuerySet:
    rows = queryset.values_list("id", "latitude", "longitude")

    nearby: list[tuple[int, float]] = []
    for user_id, candidate_lat, candidate_lon in rows:
        candidate_lat_f = _safe_float(candidate_lat)
        candidate_lon_f = _safe_float(candidate_lon)
        if candidate_lat_f is None or candidate_lon_f is None:
            continue
        distance = _haversine_km(lat, lon, candidate_lat_f, candidate_lon_f)
        if distance <= radius_km:
            nearby.append((user_id, distance))

    nearby.sort(key=lambda row: (row[1], row[0]))
    top = nearby[:limit]
    if not top:
        return User.objects.none()

    ordered_ids: list[int] = [row[0] for row in top]
    distance_by_id = {user_id: distance for user_id, distance in top}

    order_case = Case(
        *[When(pk=user_id, then=Value(index)) for index, user_id in enumerate(ordered_ids)],
        output_field=IntegerField(),
    )
    distance_case = Case(
        *[
            When(pk=user_id, then=Value(distance_by_id[user_id]))
            for user_id in ordered_ids
        ],
        output_field=FloatField(),
    )

    return (
        queryset.filter(pk__in=ordered_ids)
        .annotate(distance_km=distance_case, _distance_order=order_case)
        .order_by("_distance_order")
    )


def get_nearby_candidates(user, limit: int = 1000) -> QuerySet:
    """
    Return nearby candidate users for matching.

    Rules:
    - Excludes self.
    - Applies mutual gender preference filtering.
    - Excludes users already swiped by current user.
    - Excludes users already matched with current user.
    - Applies 50km radius filter from current user's coordinates.
    - Orders nearest first.
    - Caps result size to 100..1000.
    """
    safe_limit = _normalized_limit(limit)

    lat = _safe_float(getattr(user, "latitude", None))
    lon = _safe_float(getattr(user, "longitude", None))
    if lat is None or lon is None:
        return User.objects.none()

    base_queryset = _compatible_gender_queryset(user).exclude(
        Q(latitude__isnull=True) | Q(longitude__isnull=True)
    )
    base_queryset = _exclude_swiped_and_matched(base_queryset, user)
    base_queryset = _apply_bounding_box(base_queryset, lat, lon, DEFAULT_RADIUS_KM)

    if connection.vendor == "postgresql":
        return _distance_ordered_postgres_queryset(
            base_queryset,
            lat=lat,
            lon=lon,
            radius_km=DEFAULT_RADIUS_KM,
            limit=safe_limit,
        )

    return _distance_ordered_fallback_queryset(
        base_queryset,
        lat=lat,
        lon=lon,
        radius_km=DEFAULT_RADIUS_KM,
        limit=safe_limit,
    )
