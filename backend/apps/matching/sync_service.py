from __future__ import annotations

import logging
from typing import Dict, Iterable, List, Set, Tuple

from django.contrib.auth import get_user_model
from django.db.models import Q

from apps.users.services import calculate_user_guna_match, calculate_user_personality_match

from .models import Match

logger = logging.getLogger(__name__)
User = get_user_model()

KUNDALI_MAX_SCORE = 36.0
KUNDALI_WEIGHT = 80.0
PERSONALITY_WEIGHT = 20.0


def _canonical_pair_ids(left_user_id: int, right_user_id: int) -> Tuple[int, int]:
    return (left_user_id, right_user_id) if left_user_id < right_user_id else (right_user_id, left_user_id)


def _preferred_genders(preference: str | None) -> tuple[str, ...] | None:
    normalized = (preference or "").strip().lower()
    if normalized == "everyone":
        return None
    if normalized in {"male", "female"}:
        return (normalized,)
    return None


def _valid_candidates_queryset(user):
    queryset = (
        User.objects.exclude(pk=user.pk)
        .select_related("trait_profile", "kundali_profile")
        .filter(trait_profile__isnull=False, kundali_profile__isnull=False)
    )

    preferred = _preferred_genders(getattr(user, "preference", None))
    if preferred is not None:
        queryset = queryset.filter(gender__in=preferred)

    user_gender = str(getattr(user, "gender", "") or "").strip().lower()
    if user_gender in {"male", "female"}:
        queryset = queryset.filter(Q(preference="everyone") | Q(preference=user_gender))
    else:
        queryset = queryset.filter(preference="everyone")

    return queryset.order_by("id")


def _final_score(kundali_score: float, personality_score: float) -> float:
    return round(
        ((kundali_score / KUNDALI_MAX_SCORE) * KUNDALI_WEIGHT)
        + ((personality_score / 100.0) * PERSONALITY_WEIGHT),
        2,
    )


def _existing_pair_keys_for_batch(user_id: int, candidate_ids: Iterable[int]) -> Set[Tuple[int, int]]:
    rows = Match.objects.filter(
        Q(user_a_id=user_id, user_b_id__in=candidate_ids)
        | Q(user_b_id=user_id, user_a_id__in=candidate_ids)
    ).values_list("user_a_id", "user_b_id")
    return {_canonical_pair_ids(left_id, right_id) for left_id, right_id in rows}


def sync_matches_for_user(user_id: int, *, candidate_batch_size: int = 100) -> Dict[str, int]:
    """
    Background sync for one user:
    - scans ALL valid candidates (no limit) in candidate batches
    - computes full kundali + personality scores
    - creates new suggested Match rows in bulk
    - skips already processed pairs (existing Match rows)
    """
    batch_size = max(10, min(int(candidate_batch_size or 100), 1000))

    user = (
        User.objects.select_related("trait_profile", "kundali_profile")
        .filter(id=user_id)
        .first()
    )
    if user is None:
        return {
            "user_id": user_id,
            "candidate_batches": 0,
            "pairs_scanned": 0,
            "pairs_skipped_existing": 0,
            "pairs_scored": 0,
            "pairs_created": 0,
            "errors": 1,
        }

    stats = {
        "user_id": user_id,
        "candidate_batches": 0,
        "pairs_scanned": 0,
        "pairs_skipped_existing": 0,
        "pairs_scored": 0,
        "pairs_created": 0,
        "errors": 0,
    }

    queryset = _valid_candidates_queryset(user)
    last_candidate_id = 0

    while True:
        batch = list(queryset.filter(id__gt=last_candidate_id)[:batch_size])
        if not batch:
            break

        stats["candidate_batches"] += 1
        stats["pairs_scanned"] += len(batch)

        candidate_ids = [candidate.id for candidate in batch]
        existing_pair_keys = _existing_pair_keys_for_batch(user.id, candidate_ids)

        to_create: List[Match] = []
        for candidate in batch:
            pair_key = _canonical_pair_ids(user.id, candidate.id)
            if pair_key in existing_pair_keys:
                stats["pairs_skipped_existing"] += 1
                continue

            try:
                kundali_payload = calculate_user_guna_match(user, candidate)
                personality_payload = calculate_user_personality_match(user, candidate)
                kundali_score = float(kundali_payload.get("total_score", 0.0))
                personality_score = float(personality_payload.get("personality_score", 0.0))
            except Exception:
                stats["errors"] += 1
                continue

            final_score = _final_score(kundali_score, personality_score)
            stats["pairs_scored"] += 1

            to_create.append(
                Match(
                    user_a_id=pair_key[0],
                    user_b_id=pair_key[1],
                    kundali_score=round(kundali_score, 2),
                    personality_score=round(personality_score, 2),
                    final_score=final_score,
                    match_type="Background Synced Match",
                    insight_text="",
                    status=Match.Status.SUGGESTED,
                    is_visible=True,
                )
            )

        if to_create:
            Match.objects.bulk_create(
                to_create,
                batch_size=batch_size,
                ignore_conflicts=True,
            )
            stats["pairs_created"] += len(to_create)

        last_candidate_id = batch[-1].id
        logger.info(
            "match_sync user_id=%s batch=%s scanned=%s created=%s skipped_existing=%s errors=%s",
            user_id,
            stats["candidate_batches"],
            stats["pairs_scanned"],
            stats["pairs_created"],
            stats["pairs_skipped_existing"],
            stats["errors"],
        )

    return stats


def sync_matches_for_all_users(*, user_batch_size: int = 100, candidate_batch_size: int = 100) -> Dict[str, int]:
    """
    Multi-user background sync entrypoint.

    - Iterates users in batches
    - Calls sync_matches_for_user per user
    - Avoids one giant transaction
    - Cursor-based traversal to stay memory safe for very large datasets
    """
    safe_user_batch_size = max(10, min(int(user_batch_size or 100), 1000))
    safe_candidate_batch_size = max(10, min(int(candidate_batch_size or 100), 1000))

    summary = {
        "users_processed": 0,
        "candidate_batches": 0,
        "pairs_scanned": 0,
        "pairs_skipped_existing": 0,
        "pairs_scored": 0,
        "pairs_created": 0,
        "errors": 0,
    }

    last_user_id = 0
    while True:
        user_ids = list(
            User.objects.filter(id__gt=last_user_id)
            .order_by("id")
            .values_list("id", flat=True)[:safe_user_batch_size]
        )
        if not user_ids:
            break

        for user_id in user_ids:
            try:
                stats = sync_matches_for_user(user_id, candidate_batch_size=safe_candidate_batch_size)
            except Exception:
                summary["errors"] += 1
                logger.exception("match_sync fatal user_id=%s", user_id)
                continue

            summary["users_processed"] += 1
            summary["candidate_batches"] += stats.get("candidate_batches", 0)
            summary["pairs_scanned"] += stats.get("pairs_scanned", 0)
            summary["pairs_skipped_existing"] += stats.get("pairs_skipped_existing", 0)
            summary["pairs_scored"] += stats.get("pairs_scored", 0)
            summary["pairs_created"] += stats.get("pairs_created", 0)
            summary["errors"] += stats.get("errors", 0)

        last_user_id = user_ids[-1]

    return summary
