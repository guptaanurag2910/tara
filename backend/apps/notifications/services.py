from typing import Optional

from django.contrib.auth import get_user_model

from .models import Notification

PREFERENCE_BY_TYPE = {
    Notification.Type.MATCH: "matches",
    Notification.Type.MESSAGE: "messages",
    Notification.Type.GAME_TURN: "game_turns",
    Notification.Type.RECOMMENDATION: "matches",
}


def create_notification_for_user(
    *,
    user_id: int,
    notification_type: str,
    text: str,
    action_url: str = "",
    actor_name: str = "",
) -> Optional[Notification]:
    preference = PREFERENCE_BY_TYPE.get(notification_type)
    if preference:
        preferences = (
            get_user_model().objects.filter(pk=user_id)
            .values_list("notification_preferences", flat=True)
            .first()
        ) or {}
        if preferences.get(preference) is False:
            return None
    return Notification.objects.create(
        user_id=user_id,
        type=notification_type,
        text=text,
        action_url=action_url,
        actor_name=actor_name,
    )


def notify_new_match(user_a_id: int, user_b_id: int, *, match_id: int | None = None) -> None:
    users = get_user_model().objects.in_bulk([user_a_id, user_b_id])
    for recipient_id, partner_id in ((user_a_id, user_b_id), (user_b_id, user_a_id)):
        partner = users.get(partner_id)
        partner_name = partner.name if partner else "someone new"
        create_notification_for_user(
            user_id=recipient_id,
            notification_type=Notification.Type.MATCH,
            text=f"You and {partner_name} are connected! Say hello ✨",
            action_url=f"/chat/{match_id}" if match_id else "/matches",
            actor_name=partner_name,
        )


def notify_new_message(*, recipient_user_id: int, sender_name: str = "", match_id: int | None = None) -> Optional[Notification]:
    text = f"{sender_name} sent you a message" if sender_name else "You have a new message"
    return create_notification_for_user(
        user_id=recipient_user_id,
        notification_type=Notification.Type.MESSAGE,
        text=text,
        action_url=f"/chat/{match_id}" if match_id else "/chat",
        actor_name=sender_name,
    )


def notify_game_turn(*, recipient_user_id: int, game_name: str = "This or That", match_id: int | None = None) -> Optional[Notification]:
    return create_notification_for_user(
        user_id=recipient_user_id,
        notification_type=Notification.Type.GAME_TURN,
        text=f"Your turn in {game_name} ✨",
        action_url=f"/chat/{match_id}" if match_id else "/chat",
    )


def notify_daily_recommendation(*, user_id: int, top_match_name: Optional[str] = None) -> Optional[Notification]:
    if top_match_name:
        message = f"A new person to explore: {top_match_name} ✨"
    else:
        message = "New people to explore are ready ✨"
    return create_notification_for_user(
        user_id=user_id,
        notification_type=Notification.Type.RECOMMENDATION,
        text=message,
        action_url="/discover",
        actor_name=top_match_name or "",
    )
