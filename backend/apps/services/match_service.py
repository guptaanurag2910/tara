from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When

from apps.matching.models import Match
from apps.users.models import KundaliProfile, Trait
from apps.users.services import calculate_personality_match

from .filter_service import get_nearby_candidates

User = get_user_model()

INITIAL_CANDIDATE_LIMIT = 300
TOP_MATCHES_LIMIT = 20
KUNDALI_MAX_SCORE = 36.0
KUNDALI_WEIGHT = 80.0
PERSONALITY_WEIGHT = 0.2


def _canonical_pair_ids(left_user_id: int, right_user_id: int) -> Tuple[int, int]:
    return (left_user_id, right_user_id) if left_user_id < right_user_id else (right_user_id, left_user_id)


def _safe_traits(user) -> Dict[str, object]:
    try:
        return (user.trait_profile.traits or {}) if user.trait_profile else {}
    except Trait.DoesNotExist:
        return {}


def _safe_kundali(user):
    try:
        return user.kundali_profile
    except KundaliProfile.DoesNotExist:
        return None


def _normalized_values(values: Iterable[object]) -> set[str]:
    normalized = set()
    for value in values or []:
        text = str(value or "").strip().lower()
        if text:
            normalized.add(text)
    return normalized


def _lightweight_personality_score(
    user_traits: Dict[str, object],
    user_interests: set[str],
    candidate,
) -> float:
    candidate_traits = _safe_traits(candidate)
    if user_traits and candidate_traits:
        score_payload = calculate_personality_match(user_traits, candidate_traits)
        return float(score_payload.get("personality_score", 0.0))

    candidate_interests = _normalized_values(getattr(candidate, "interests", []))
    if not user_interests or not candidate_interests:
        return 0.0

    overlap = len(user_interests.intersection(candidate_interests))
    union = len(user_interests.union(candidate_interests))
    if union == 0:
        return 0.0
    return round((overlap / union) * 100.0, 2)


def _lightweight_kundali_score(user_kundali, candidate_kundali) -> float:
    """
    Fast, cached-only kundali proxy score (0..36).
    Uses already stored profile fields and does not run heavy ephemeris calculations.
    """
    if not user_kundali or not candidate_kundali:
        return 0.0

    score = 0.0

    if (user_kundali.moon_sign or "").lower() == (candidate_kundali.moon_sign or "").lower():
        score += 12.0
    if (user_kundali.lagna or "").lower() == (candidate_kundali.lagna or "").lower():
        score += 8.0
    if (user_kundali.nakshatra or "").lower() == (candidate_kundali.nakshatra or "").lower():
        score += 4.0
    if (user_kundali.gana or "").lower() == (candidate_kundali.gana or "").lower():
        score += 4.0
    if (user_kundali.bhakoot or "").lower() == (candidate_kundali.bhakoot or "").lower():
        score += 3.0
    if (user_kundali.varna or "").lower() == (candidate_kundali.varna or "").lower():
        score += 2.0
    if (
        user_kundali.nadi
        and candidate_kundali.nadi
        and (user_kundali.nadi or "").lower() != (candidate_kundali.nadi or "").lower()
    ):
        score += 3.0

    return min(KUNDALI_MAX_SCORE, round(score, 2))


def _final_score(kundali_score: float, personality_score: float) -> float:
    return round(((kundali_score / KUNDALI_MAX_SCORE) * KUNDALI_WEIGHT) + (personality_score * PERSONALITY_WEIGHT), 2)


@transaction.atomic
def generate_initial_matches(user):
    """
    Generate initial nearby suggested matches for a user.

    Flow:
    1. Fetch nearby candidates.
    2. Cap to top 300.
    3. Compute lightweight compatibility scores.
    4. Bulk create suggested Match rows.
    5. Return top 20 suggested matches by final_score.
    """
    candidates = list(
        get_nearby_candidates(user, limit=1000)
        .select_related("trait_profile", "kundali_profile")
        .order_by("distance_km", "id")[:INITIAL_CANDIDATE_LIMIT]
    )
    if not candidates:
        return Match.objects.none()

    user_traits = _safe_traits(user)
    user_interests = _normalized_values(getattr(user, "interests", []))
    user_kundali = _safe_kundali(user)

    candidate_ids = [candidate.id for candidate in candidates]
    existing_pairs = set(
        Match.objects.filter(
            Q(user_a_id=user.id, user_b_id__in=candidate_ids)
            | Q(user_b_id=user.id, user_a_id__in=candidate_ids)
        ).values_list("user_a_id", "user_b_id")
    )

    to_create: List[Match] = []
    for candidate in candidates:
        pair_ids = _canonical_pair_ids(user.id, candidate.id)
        if pair_ids in existing_pairs:
            continue

        kundali_score = _lightweight_kundali_score(user_kundali, _safe_kundali(candidate))
        personality_score = _lightweight_personality_score(user_traits, user_interests, candidate)
        final_score = _final_score(kundali_score, personality_score)

        to_create.append(
            Match(
                user_a_id=pair_ids[0],
                user_b_id=pair_ids[1],
                kundali_score=kundali_score,
                personality_score=personality_score,
                final_score=final_score,
                match_type="Initial Nearby Match",
                insight_text="Generated from nearby radius + lightweight compatibility.",
                status=Match.Status.SUGGESTED,
                is_visible=True,
            )
        )

    if to_create:
        Match.objects.bulk_create(to_create, batch_size=200, ignore_conflicts=True)

    top_qs = (
        Match.objects.filter(
            status=Match.Status.SUGGESTED,
            is_visible=True,
        )
        .filter(Q(user_a_id=user.id) | Q(user_b_id=user.id))
        .select_related("user_a", "user_b")
        .order_by("-final_score", "-id")[:TOP_MATCHES_LIMIT]
    )

    # Keep deterministic DB ordering for callers that iterate multiple times.
    ordered_ids = list(top_qs.values_list("id", flat=True))
    if not ordered_ids:
        return Match.objects.none()

    preserve_order = Case(
        *[When(id=row_id, then=Value(index)) for index, row_id in enumerate(ordered_ids)],
        output_field=IntegerField(),
    )
    return Match.objects.filter(id__in=ordered_ids).select_related("user_a", "user_b").order_by(preserve_order)

