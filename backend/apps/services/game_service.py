import random
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F

from apps.games.models import GameCategory, GameQuestion, GameResponse

User = get_user_model()


def get_random_questions(user: User, category, limit: int = 3) -> list[dict[str, Any]]:
    """
    Return random questions for a category while prioritizing unseen questions.

    Seen questions are determined from GameResponse for the given user.
    If unseen questions are fewer than `limit`, falls back to the full pool.
    """
    user_id = getattr(user, "id", None)
    if not user_id:
        return []

    try:
        requested_limit = int(limit)
    except (TypeError, ValueError):
        requested_limit = 3
    if requested_limit <= 0:
        return []

    category_obj = _resolve_category(category)
    if category_obj is None:
        return []

    base_qs = GameQuestion.objects.filter(
        category_id=category_obj.id,
        is_active=True,
        game__is_active=True,
    )
    all_ids = list(base_qs.values_list("id", flat=True))
    if not all_ids:
        return []

    effective_limit = min(requested_limit, len(all_ids))

    seen_ids = set(
        GameResponse.objects.filter(
            user_id=user_id,
            question_id__in=all_ids,
        )
        .values_list("question_id", flat=True)
        .distinct()
    )

    unseen_ids = [qid for qid in all_ids if qid not in seen_ids]
    selected_ids: list[int] = []

    if unseen_ids:
        take_unseen = min(effective_limit, len(unseen_ids))
        selected_ids.extend(random.sample(unseen_ids, take_unseen))

    if len(selected_ids) < effective_limit:
        selected_set = set(selected_ids)
        fallback_pool = [qid for qid in all_ids if qid not in selected_set]
        remaining = effective_limit - len(selected_ids)
        if fallback_pool and remaining > 0:
            selected_ids.extend(random.sample(fallback_pool, min(remaining, len(fallback_pool))))

    if not selected_ids:
        return []

    question_rows = list(
        GameQuestion.objects.filter(id__in=selected_ids)
        .values("id", "question_text", "options", "game_type")
    )
    question_by_id = {row["id"]: row for row in question_rows}
    ordered_result = [question_by_id[qid] for qid in selected_ids if qid in question_by_id]

    with transaction.atomic():
        GameQuestion.objects.filter(id__in=selected_ids).update(times_used=F("times_used") + 1)

    return ordered_result


def _resolve_category(category) -> GameCategory | None:
    if isinstance(category, GameCategory):
        if category.is_active:
            return category
        return None

    if isinstance(category, int):
        return (
            GameCategory.objects.only("id", "is_active")
            .filter(id=category, is_active=True)
            .first()
        )

    category_slug = str(category or "").strip()
    if not category_slug:
        return None

    return (
        GameCategory.objects.only("id", "slug", "is_active")
        .filter(slug=category_slug, is_active=True)
        .first()
    )
