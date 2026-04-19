from typing import Optional

from .models import Notification


def create_notification_for_user(
    *,
    user_id: int,
    notification_type: str,
    text: str,
) -> Notification:
    return Notification.objects.create(
        user_id=user_id,
        type=notification_type,
        text=text,
    )


def notify_new_match(user_a_id: int, user_b_id: int) -> None:
    Notification.objects.bulk_create(
        [
            Notification(
                user_id=user_a_id,
                type=Notification.Type.MATCH,
                text="You have a new match 🔮",
            ),
            Notification(
                user_id=user_b_id,
                type=Notification.Type.MATCH,
                text="You have a new match 🔮",
            ),
        ]
    )


def notify_new_message(*, recipient_user_id: int) -> Notification:
    return create_notification_for_user(
        user_id=recipient_user_id,
        notification_type=Notification.Type.MESSAGE,
        text="Someone messaged you 👀",
    )


def notify_daily_recommendation(*, user_id: int, top_match_name: Optional[str] = None) -> Notification:
    if top_match_name:
        message = f"Your top match today is waiting ✨ {top_match_name}"
    else:
        message = "Your top match today is waiting ✨"
    return create_notification_for_user(
        user_id=user_id,
        notification_type=Notification.Type.RECOMMENDATION,
        text=message,
    )
