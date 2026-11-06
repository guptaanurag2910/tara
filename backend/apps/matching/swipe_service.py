from __future__ import annotations

from typing import Dict, Tuple

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.chat.services import create_game_event_message
from apps.chat.models import Message
from apps.notifications.services import notify_new_message

from .models import Match, RecommendationQueue, Swipe, UserBlock
from .services import create_match_from_mutual_like


def _canonical_pair_ids(user_a_id: int, user_b_id: int) -> Tuple[int, int]:
    return (user_a_id, user_b_id) if user_a_id < user_b_id else (user_b_id, user_a_id)


def _get_or_create_pair_match(left_id: int, right_id: int, *, status: str) -> Match:
    match, _ = Match.objects.get_or_create(
        user_a_id=left_id,
        user_b_id=right_id,
        defaults={
            "kundali_score": 0.0,
            "personality_score": 0.0,
            "final_score": 0.0,
            "match_type": "Swipe Match",
            "insight_text": "",
            "status": status,
            "matched_at": timezone.now() if status == Match.Status.MATCHED else None,
            "is_visible": True,
        },
    )
    return match


def _ensure_match_chat(match: Match, actor_user_id: int) -> None:
    # Dedupe by deterministic event id so retries don't create duplicate chat events.
    create_game_event_message(
        match_id=match.id,
        sender_id=actor_user_id,
        content="It's a match! Start the conversation ✨",
        event_type="match_created",
        payload={"match_id": match.id},
        dedupe_key=f"match-created:{match.id}",
        broadcast=True,
    )


@transaction.atomic
def handle_swipe(user, target_user, action: str, *, note: str = "") -> Dict[str, object]:
    """
    Record a swipe and resolve like/pass side effects.

    Behavior:
    - Creates/updates Swipe row (duplicate-safe).
    - Like + reverse-like => match becomes MATCHED and a chat event is created.
    - Pass => pair status becomes REJECTED (unless pair is already MATCHED).
    """
    if user.id == target_user.id:
        raise ValueError("You cannot swipe on yourself.")
    if UserBlock.objects.filter(
        Q(blocker_id=user.id, blocked_user_id=target_user.id)
        | Q(blocker_id=target_user.id, blocked_user_id=user.id)
    ).exists():
        raise ValueError("This profile is no longer available.")

    normalized_action = str(action or "").strip().lower()
    if normalized_action not in {Swipe.Action.LIKE, Swipe.Action.PASS}:
        raise ValueError("action must be 'like' or 'pass'.")

    clean_note = note.strip() if normalized_action == Swipe.Action.LIKE else ""
    RecommendationQueue.objects.filter(user=user, target_user=target_user).update(
        status=RecommendationQueue.Status.ACTED, acted_at=timezone.now()
    )
    swipe, created = Swipe.objects.select_for_update().get_or_create(
        user=user,
        target_user=target_user,
        defaults={"action": normalized_action, "note": clean_note},
    )
    if not created and (swipe.action != normalized_action or swipe.note != clean_note):
        swipe.action = normalized_action
        swipe.note = clean_note
        swipe.note_delivered_at = None
        swipe.save(update_fields=["action", "note", "note_delivered_at", "updated_at"])

    left_id, right_id = _canonical_pair_ids(user.id, target_user.id)

    if normalized_action == Swipe.Action.LIKE:
        reverse_like_exists = Swipe.objects.filter(
            user=target_user,
            target_user=user,
            action=Swipe.Action.LIKE,
        ).exists()

        if reverse_like_exists:
            match = create_match_from_mutual_like(user, target_user)
            _ensure_match_chat(match, actor_user_id=user.id)
            for liked_swipe in Swipe.objects.select_for_update().filter(
                user_id__in=(user.id, target_user.id),
                target_user_id__in=(user.id, target_user.id),
                action=Swipe.Action.LIKE,
                note_delivered_at__isnull=True,
            ).exclude(note="").order_by("created_at"):
                Message.objects.create(
                    match=match,
                    sender_id=liked_swipe.user_id,
                    content=liked_swipe.note,
                    message_type=Message.MessageType.TEXT,
                    game_payload={"source": "like_note", "swipe_id": liked_swipe.id},
                    status=Message.Status.DELIVERED,
                )
                liked_swipe.note_delivered_at = timezone.now()
                liked_swipe.save(update_fields=["note_delivered_at"])
                notify_new_message(
                    recipient_user_id=liked_swipe.target_user_id,
                    sender_name=liked_swipe.user.name,
                    match_id=match.id,
                )
            return {
                "swipe_id": swipe.id,
                "target_user_id": target_user.id,
                "action": Swipe.Action.LIKE,
                "is_match": True,
                "match_id": match.id,
                "status": Match.Status.MATCHED,
                "matched_at": match.matched_at,
            }

        match = Match.objects.filter(user_a_id=left_id, user_b_id=right_id).first()
        if match and match.status != Match.Status.MATCHED:
            match.status = Match.Status.LIKED
            match.save(update_fields=["status", "updated_at"])

        return {
            "swipe_id": swipe.id,
            "target_user_id": target_user.id,
            "action": Swipe.Action.LIKE,
            "is_match": False,
            "match_id": None,
            "status": Match.Status.LIKED,
            "matched_at": None,
        }

    # PASS flow
    match = _get_or_create_pair_match(left_id, right_id, status=Match.Status.REJECTED)
    if match.status != Match.Status.MATCHED and match.status != Match.Status.REJECTED:
        match.status = Match.Status.REJECTED
        match.save(update_fields=["status", "updated_at"])

    return {
        "swipe_id": swipe.id,
        "target_user_id": target_user.id,
        "action": Swipe.Action.PASS,
        "is_match": False,
        "match_id": match.id if match.status == Match.Status.MATCHED else None,
        "status": match.status,
        "matched_at": match.matched_at,
    }

