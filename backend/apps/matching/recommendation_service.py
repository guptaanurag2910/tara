import logging
from typing import Dict, List, Optional

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.notifications.services import notify_daily_recommendation
from apps.users.services import calculate_kundali
from apps.users.models import KundaliProfile, Trait
from apps.users.services import calculate_user_final_match, generate_match_insight

from .models import DailyRecommendation, Match

User = get_user_model()
logger = logging.getLogger(__name__)

RECOMMENDATION_CACHE_TTL_SECONDS = 300
DEFAULT_RECOMMENDATION_LIMIT = 50
DEFAULT_DAILY_RECOMMENDATION_LIMIT = 10
TOP_MATCH_LIMIT = 3
TOP_MATCH_TAG = "Top Match"
HIGH_COMPATIBILITY_TAG = "High Compatibility"


def _cache_key(user_id: int, limit: int) -> str:
    return f"matching:recommendations:{user_id}:limit:{limit}:v1"


def _preferred_genders(preference: str) -> Optional[List[str]]:
    normalized = str(preference or "").strip().lower()
    if normalized == "everyone":
        return None
    if normalized in {"male", "female"}:
        return [normalized]
    return None


def _age_from_dob(date_of_birth) -> Optional[int]:
    if date_of_birth is None:
        return None
    today = timezone.localdate()
    years = today.year - date_of_birth.year
    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        years -= 1
    return years


def _candidate_queryset(user):
    queryset = User.objects.exclude(pk=user.pk).select_related("trait_profile", "kundali_profile")

    preferred = _preferred_genders(user.preference)
    if preferred is not None:
        queryset = queryset.filter(gender__in=preferred)

    user_gender = str(user.gender or "").strip().lower()
    if user_gender in {"male", "female"}:
        queryset = queryset.filter(Q(preference="everyone") | Q(preference=user_gender))
    else:
        queryset = queryset.filter(preference="everyone")

    return queryset.order_by("id")


def _bootstrap_kundali_profile(user) -> Optional[KundaliProfile]:
    try:
        payload = calculate_kundali(
            date_of_birth=user.date_of_birth,
            birth_time=user.birth_time,
            latitude=user.latitude,
            longitude=user.longitude,
            place_of_birth=user.birth_place,
        )
    except Exception:
        logger.exception("Unable to bootstrap kundali for user_id=%s", user.id)
        return None

    defaults = {
        "lagna": payload.get("lagna", ""),
        "sun_sign": payload.get("sun_sign", ""),
        "moon_sign": payload.get("moon_sign", ""),
        "ascendant_degree": payload.get("ascendant_degree"),
        "nakshatra": payload.get("nakshatra", ""),
        "nakshatra_pada": payload.get("nakshatra_pada") or 1,
        "varna": payload.get("varna", ""),
        "vashya": payload.get("vashya", ""),
        "gana": payload.get("gana", ""),
        "yoni": payload.get("yoni", ""),
        "nadi": payload.get("nadi", ""),
        "bhakoot": payload.get("bhakoot", ""),
        "timezone_name": payload.get("timezone_name", ""),
        "chart_data": payload.get("chart_data", {}),
        "is_accurate": bool(payload.get("is_accurate", False)),
    }

    profile, _ = KundaliProfile.objects.update_or_create(user=user, defaults=defaults)
    return profile


def _has_required_profiles(user) -> bool:
    trait_profile = None
    kundali_profile = None

    try:
        trait_profile = user.trait_profile
    except Trait.DoesNotExist:
        trait_profile, _ = Trait.objects.get_or_create(user=user, defaults={"traits": {}})

    try:
        kundali_profile = user.kundali_profile
    except KundaliProfile.DoesNotExist:
        kundali_profile = _bootstrap_kundali_profile(user)

    if trait_profile is None or kundali_profile is None:
        return False

    # Keep relations hot on the in-memory instance to avoid extra reads.
    user.trait_profile = trait_profile
    user.kundali_profile = kundali_profile
    return True


def _persist_recommendations(user, recommendations: List[Dict[str, object]]) -> None:
    if not recommendations:
        return

    candidate_ids = [item["candidate"].id for item in recommendations]
    existing_matches = Match.objects.filter(
        Q(user_a_id=user.id, user_b_id__in=candidate_ids)
        | Q(user_b_id=user.id, user_a_id__in=candidate_ids)
    )

    existing_by_candidate_id = {}
    for match in existing_matches:
        other_user_id = match.user_b_id if match.user_a_id == user.id else match.user_a_id
        existing_by_candidate_id[other_user_id] = match

    to_create: List[Match] = []
    to_update: List[Match] = []
    now = timezone.now()
    for item in recommendations:
        candidate = item["candidate"]
        existing = existing_by_candidate_id.get(candidate.id)
        if existing is not None:
            existing.kundali_score = item["kundali_score"]
            existing.personality_score = item["personality_score"]
            existing.final_score = item["compatibility_score"]
            existing.match_type = item["match_type"]
            existing.insight_text = item["insight"]
            if existing.status != Match.Status.MATCHED:
                existing.status = Match.Status.SUGGESTED
            existing.updated_at = now
            to_update.append(existing)
            continue

        user_a_id, user_b_id = (user.id, candidate.id) if user.id < candidate.id else (candidate.id, user.id)
        to_create.append(
            Match(
                user_a_id=user_a_id,
                user_b_id=user_b_id,
                kundali_score=item["kundali_score"],
                personality_score=item["personality_score"],
                final_score=item["compatibility_score"],
                match_type=item["match_type"],
                insight_text=item["insight"],
                status=Match.Status.SUGGESTED,
            )
        )

    with transaction.atomic():
        if to_create:
            Match.objects.bulk_create(to_create, ignore_conflicts=True)
        if to_update:
            Match.objects.bulk_update(
                to_update,
                fields=[
                    "kundali_score",
                    "personality_score",
                    "final_score",
                    "match_type",
                    "insight_text",
                    "status",
                    "updated_at",
                ],
            )


def _apply_highlight_tags(recommendations: List[Dict[str, object]]) -> List[Dict[str, object]]:
    tagged: List[Dict[str, object]] = []
    for index, item in enumerate(recommendations):
        rank = index + 1
        payload = dict(item)
        payload["highlight_tag"] = None
        payload["is_top_match"] = False
        payload["is_high_compatibility"] = False

        if rank == 1:
            payload["highlight_tag"] = TOP_MATCH_TAG
            payload["is_top_match"] = True
        elif rank <= TOP_MATCH_LIMIT:
            payload["highlight_tag"] = HIGH_COMPATIBILITY_TAG
            payload["is_high_compatibility"] = True

        tagged.append(payload)

    return tagged


def get_recommendations_for_user(
    user_id: int,
    *,
    limit: int = DEFAULT_RECOMMENDATION_LIMIT,
    use_cache: bool = True,
) -> List[Dict[str, object]]:
    safe_limit = max(1, min(int(limit or DEFAULT_RECOMMENDATION_LIMIT), 50))
    cache_key = _cache_key(user_id, safe_limit)

    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    user = (
        User.objects.select_related("trait_profile", "kundali_profile")
        .filter(pk=user_id)
        .first()
    )
    if user is None:
        return []
    if not _has_required_profiles(user):
        return []
    user = (
        User.objects.select_related("trait_profile", "kundali_profile")
        .filter(pk=user_id)
        .first()
    )
    if user is None:
        return []

    user_traits = user.trait_profile.traits or {}
    recommendations: List[Dict[str, object]] = []

    for candidate in _candidate_queryset(user):
        if not _has_required_profiles(candidate):
            continue
        score_payload = calculate_user_final_match(user, candidate)
        insight_text = generate_match_insight(
            user_traits,
            candidate.trait_profile.traits or {},
            {
                "kundali_score": score_payload["kundali_score"],
                "match_type": score_payload["match_type"],
            },
        )

        recommendations.append(
            {
                "candidate": candidate,
                "user_id": candidate.id,
                "name": candidate.name,
                "age": _age_from_dob(candidate.date_of_birth),
                "moon_sign": candidate.kundali_profile.moon_sign,
                "compatibility_score": score_payload["final_score"],
                "kundali_score": score_payload["kundali_score"],
                "personality_score": score_payload["personality_score"],
                "match_type": score_payload["match_type"],
                "insight": insight_text,
            }
        )

    recommendations.sort(
        key=lambda item: (
            item["compatibility_score"],
            item["kundali_score"],
            item["personality_score"],
        ),
        reverse=True,
    )
    top_recommendations = _apply_highlight_tags(recommendations[:safe_limit])

    _persist_recommendations(user, top_recommendations)
    for item in top_recommendations:
        item.pop("candidate", None)
        item.pop("match_type", None)

    if use_cache:
        cache.set(cache_key, top_recommendations, RECOMMENDATION_CACHE_TTL_SECONDS)

    return top_recommendations


def refresh_daily_recommendations(*, top_n: int = DEFAULT_DAILY_RECOMMENDATION_LIMIT) -> dict:
    """
    Recompute daily recommendations for all users and store the top picks.

    The table is refreshed per user (previous rows for that user are replaced).
    """
    safe_top_n = max(5, min(int(top_n or DEFAULT_DAILY_RECOMMENDATION_LIMIT), 10))
    user_ids = list(User.objects.values_list("id", flat=True).order_by("id"))

    users_processed = 0
    total_created = 0
    for user_id in user_ids:
        ranked = get_recommendations_for_user(user_id, limit=safe_top_n, use_cache=False)
        rows = [
            DailyRecommendation(
                user_id=user_id,
                recommended_user_id=item["user_id"],
                score=item["compatibility_score"],
            )
            for item in ranked
        ]
        with transaction.atomic():
            DailyRecommendation.objects.filter(user_id=user_id).delete()
            if rows:
                DailyRecommendation.objects.bulk_create(rows, batch_size=100)
        if rows:
            top_name = ranked[0].get("name") if ranked else None
            notify_daily_recommendation(user_id=user_id, top_match_name=top_name)
        users_processed += 1
        total_created += len(rows)

    return {
        "users_processed": users_processed,
        "recommendations_created": total_created,
        "top_n": safe_top_n,
    }
