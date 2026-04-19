from typing import Tuple

from django.db import transaction
from django.utils import timezone

from apps.notifications.services import notify_new_match
from apps.users.models import Trait
from apps.users.services import calculate_user_final_match, generate_match_insight

from .models import Match


def _canonical_pair(user_a, user_b) -> Tuple[object, object]:
    if user_a.pk is None or user_b.pk is None:
        raise ValueError("Both users must be saved before creating a match.")
    if user_a.pk == user_b.pk:
        raise ValueError("A user cannot be matched with themselves.")
    return (user_a, user_b) if user_a.pk < user_b.pk else (user_b, user_a)


def _trait_payload(user) -> dict:
    try:
        return user.trait_profile.traits or {}
    except Trait.DoesNotExist:
        return {}


@transaction.atomic
def save_match_result(
    user_a,
    user_b,
    *,
    kundali_score: int,
    personality_score: int,
    final_score: int,
    match_type: str,
    insight_text: str = "",
    status: str = Match.Status.SUGGESTED,
    matched_at=None,
) -> Match:
    """
    Create or update a match record with canonical user ordering.
    """
    left, right = _canonical_pair(user_a, user_b)

    match, created = Match.objects.select_for_update().get_or_create(
        user_a=left,
        user_b=right,
        defaults={
            "kundali_score": kundali_score,
            "personality_score": personality_score,
            "final_score": final_score,
            "match_type": match_type,
            "insight_text": insight_text,
            "status": status,
            "matched_at": matched_at if status == Match.Status.MATCHED else None,
        },
    )
    if created:
        return match

    # Keep already-established matches stable.
    resolved_status = status
    if match.status == Match.Status.MATCHED and status != Match.Status.MATCHED:
        resolved_status = Match.Status.MATCHED

    match.kundali_score = kundali_score
    match.personality_score = personality_score
    match.final_score = final_score
    match.match_type = match_type
    match.insight_text = insight_text
    match.status = resolved_status

    if resolved_status == Match.Status.MATCHED:
        match.matched_at = matched_at or match.matched_at or timezone.now()
    elif matched_at is not None:
        match.matched_at = matched_at

    match.save(
        update_fields=[
            "kundali_score",
            "personality_score",
            "final_score",
            "match_type",
            "insight_text",
            "status",
            "matched_at",
            "updated_at",
        ]
    )
    return match


@transaction.atomic
def calculate_and_save_match(
    user_a,
    user_b,
    *,
    status: str = Match.Status.SUGGESTED,
    kundali_max_score: float = 36.0,
    kundali_weight: float = 80.0,
    personality_weight: float = 20.0,
) -> Match:
    """
    Run compatibility engines and persist the final match result.
    """
    left, right = _canonical_pair(user_a, user_b)
    score_payload = calculate_user_final_match(
        left,
        right,
        kundali_max_score=kundali_max_score,
        kundali_weight=kundali_weight,
        personality_weight=personality_weight,
    )

    insight_text = generate_match_insight(
        _trait_payload(left),
        _trait_payload(right),
        {
            "kundali_score": score_payload["kundali_score"],
            "match_type": score_payload["match_type"],
        },
    )

    return save_match_result(
        left,
        right,
        kundali_score=score_payload["kundali_score"],
        personality_score=score_payload["personality_score"],
        final_score=score_payload["final_score"],
        match_type=score_payload["match_type"],
        insight_text=insight_text,
        status=status,
    )


@transaction.atomic
def create_match_from_mutual_like(
    user_a,
    user_b,
    *,
    kundali_max_score: float = 36.0,
    kundali_weight: float = 80.0,
    personality_weight: float = 20.0,
) -> Match:
    """
    Create/update a final match record when both users have liked each other.
    Copies compatibility scores and insight text into Match.
    """
    left, right = _canonical_pair(user_a, user_b)
    existing_status = (
        Match.objects.filter(user_a=left, user_b=right).values_list("status", flat=True).first()
    )

    try:
        score_payload = calculate_user_final_match(
            left,
            right,
            kundali_max_score=kundali_max_score,
            kundali_weight=kundali_weight,
            personality_weight=personality_weight,
        )
        insight_text = generate_match_insight(
            _trait_payload(left),
            _trait_payload(right),
            {
                "kundali_score": score_payload["kundali_score"],
                "match_type": score_payload["match_type"],
            },
        )
        kundali_score = score_payload["kundali_score"]
        personality_score = score_payload["personality_score"]
        final_score = score_payload["final_score"]
        match_type = score_payload["match_type"]
    except ValueError:
        kundali_score = 0
        personality_score = 0
        final_score = 0
        match_type = "Matched by swipe"
        insight_text = "You both liked each other."

    match = save_match_result(
        left,
        right,
        kundali_score=kundali_score,
        personality_score=personality_score,
        final_score=final_score,
        match_type=match_type,
        insight_text=insight_text,
        status=Match.Status.MATCHED,
        matched_at=timezone.now(),
    )
    if existing_status != Match.Status.MATCHED and match.status == Match.Status.MATCHED:
        notify_new_match(left.id, right.id)
    return match
