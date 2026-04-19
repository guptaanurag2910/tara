from __future__ import annotations

import logging
from typing import Dict, Iterable, List, Tuple

from django.contrib.auth import get_user_model
from django.db.models import Q

from apps.services.matching.filter_service import get_nearby_candidates

from .models import Match

logger = logging.getLogger(__name__)
User = get_user_model()

DEFAULT_INJECTION_LIMIT = 300
MIN_INJECTION_LIMIT = 200
MAX_INJECTION_LIMIT = 500
DEFAULT_BULK_BATCH_SIZE = 200


def _normalize_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_INJECTION_LIMIT
    try:
        parsed = int(limit)
    except (TypeError, ValueError):
        parsed = DEFAULT_INJECTION_LIMIT
    return max(MIN_INJECTION_LIMIT, min(parsed, MAX_INJECTION_LIMIT))


def _canonical_pair_ids(left_user_id: int, right_user_id: int) -> Tuple[int, int]:
    return (left_user_id, right_user_id) if left_user_id < right_user_id else (right_user_id, left_user_id)


def _existing_pair_keys(new_user_id: int, other_user_ids: Iterable[int]) -> set[tuple[int, int]]:
    rows = Match.objects.filter(
        Q(user_a_id=new_user_id, user_b_id__in=other_user_ids)
        | Q(user_b_id=new_user_id, user_a_id__in=other_user_ids)
    ).values_list("user_a_id", "user_b_id")
    return {_canonical_pair_ids(left_id, right_id) for left_id, right_id in rows}


def inject_new_user_into_pool(new_user, *, limit: int = DEFAULT_INJECTION_LIMIT) -> Dict[str, int]:
    """
    Ensure a newly onboarded user appears in nearby users' recommendation pool.

    This function is designed to be called from an async/background worker.
    """
    if new_user is None or getattr(new_user, "id", None) is None:
        return {"new_user_id": 0, "considered_users": 0, "created_matches": 0}

    safe_limit = _normalize_limit(limit)
    nearby_users = list(
        get_nearby_candidates(new_user, limit=safe_limit)
        .only("id")
        .order_by("distance_km", "id")[:safe_limit]
    )
    if not nearby_users:
        return {"new_user_id": int(new_user.id), "considered_users": 0, "created_matches": 0}

    other_user_ids = [other.id for other in nearby_users]
    existing_pairs = _existing_pair_keys(int(new_user.id), other_user_ids)

    rows_to_create: List[Match] = []
    for other_user_id in other_user_ids:
        pair = _canonical_pair_ids(int(other_user_id), int(new_user.id))
        if pair in existing_pairs:
            continue

        # We seed lightweight suggested rows so the new profile appears in discovery quickly.
        rows_to_create.append(
            Match(
                user_a_id=pair[0],
                user_b_id=pair[1],
                kundali_score=0.0,
                personality_score=0.0,
                final_score=0.0,
                match_type="New User Pool Injection",
                insight_text="",
                status=Match.Status.SUGGESTED,
                is_visible=True,
            )
        )

    if rows_to_create:
        Match.objects.bulk_create(
            rows_to_create,
            batch_size=DEFAULT_BULK_BATCH_SIZE,
            ignore_conflicts=True,
        )

    logger.info(
        "new_user_injection user_id=%s nearby_considered=%s created=%s",
        new_user.id,
        len(other_user_ids),
        len(rows_to_create),
    )
    return {
        "new_user_id": int(new_user.id),
        "considered_users": len(other_user_ids),
        "created_matches": len(rows_to_create),
    }


def inject_new_user_into_pool_background(new_user_id: int, *, limit: int = DEFAULT_INJECTION_LIMIT) -> Dict[str, int]:
    """
    Background-job friendly wrapper.
    Call this with user id from worker/cron queue.
    """
    new_user = User.objects.filter(id=new_user_id).first()
    if new_user is None:
        return {"new_user_id": int(new_user_id), "considered_users": 0, "created_matches": 0}
    return inject_new_user_into_pool(new_user, limit=limit)

