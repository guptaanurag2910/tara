import random
from typing import Any, Optional

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F

from apps.games.models import GameCategory, GameQuestion, GameResponse, QuestionExposure

User = get_user_model()


def get_random_questions(
    user: User,
    category,
    limit: int = 5,
    exclude_user_ids: Optional[list[int]] = None,
) -> list[dict[str, Any]]:
    """
    Return random questions for a category while prioritizing unseen questions.

    Prefer questions neither participant has answered before. Repeats are only
    used when the unseen pool is smaller than the requested session.
    """
    user_id = getattr(user, "id", None)
    if not user_id:
        return []

    try:
        requested_limit = int(limit)
    except (TypeError, ValueError):
        requested_limit = 5
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

    participant_ids = {user_id}
    participant_ids.update(int(value) for value in (exclude_user_ids or []) if value)
    seen_ids = set(
        GameResponse.objects.filter(
            user_id__in=participant_ids,
            question_id__in=all_ids,
        )
        .values_list("question_id", flat=True)
        .distinct()
    )
    seen_ids.update(
        QuestionExposure.objects.filter(
            user_id__in=participant_ids,
            question_id__in=all_ids,
        ).values_list("question_id", flat=True)
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


def get_random_adventure_questions(
    user: User,
    *,
    exclude_user_ids: Optional[list[int]] = None,
) -> list[dict[str, Any]]:
    """Select one complete, unseen five-stage adventure for a new session."""
    if not getattr(user, "id", None):
        return []
    category = _resolve_category("choose_your_adventure")
    if category is None:
        return []
    rows = list(
        GameQuestion.objects.filter(
            category_id=category.id, is_active=True, game__is_active=True,
        ).order_by("order", "id").values("id", "question_text", "options", "game_type", "tags", "order")
    )
    adventures: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        tags = row.get("tags") or []
        if tags:
            adventures.setdefault(str(tags[0]), []).append(row)
    complete = [group for group in adventures.values() if len(group) == 5]
    if not complete:
        return []

    participant_ids = {int(user.id)}
    participant_ids.update(int(value) for value in (exclude_user_ids or []) if value)
    question_ids = [row["id"] for group in complete for row in group]
    seen_ids = set(GameResponse.objects.filter(
        user_id__in=participant_ids, question_id__in=question_ids,
    ).values_list("question_id", flat=True).distinct())
    seen_ids.update(QuestionExposure.objects.filter(
        user_id__in=participant_ids, question_id__in=question_ids,
    ).values_list("question_id", flat=True))
    unseen = [group for group in complete if not any(row["id"] in seen_ids for row in group)]
    selected = random.choice(unseen or complete)
    selected_ids = [row["id"] for row in selected]
    GameQuestion.objects.filter(id__in=selected_ids).update(times_used=F("times_used") + 1)
    return [{
        "id": row["id"],
        "question_text": row["question_text"],
        "options": row["options"] or [],
        "game_type": row["game_type"],
    } for row in selected]


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
