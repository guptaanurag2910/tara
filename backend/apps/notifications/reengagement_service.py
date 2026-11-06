from datetime import timedelta
from typing import Dict

from django.contrib.auth import get_user_model
from django.db.models import Case, F, IntegerField, Q, When
from django.utils import timezone

from apps.chat.models import Message
from apps.matching.models import Match

from .models import Notification
from .services import create_notification_for_user

User = get_user_model()

INACTIVE_NOTIFICATION_TEXT = "New people to explore are ready whenever you are ✨"
UNREAD_MESSAGE_NOTIFICATION_TEXT = "A conversation has a new message"


def _has_recent_notification(
    *,
    user_id: int,
    notification_type: str,
    text: str,
    cooldown_hours: int,
) -> bool:
    since = timezone.now() - timedelta(hours=max(1, cooldown_hours))
    return Notification.objects.filter(
        user_id=user_id,
        type=notification_type,
        text=text,
        created_at__gte=since,
    ).exists()


def trigger_inactive_user_notifications(
    *,
    inactive_hours: int = 24,
    cooldown_hours: int = 24,
) -> int:
    """
    Notify users inactive for the configured time window.

    Inactivity is based on `last_login`, with `date_joined` as fallback.
    """
    cutoff = timezone.now() - timedelta(hours=max(1, inactive_hours))
    users = User.objects.filter(is_active=True).filter(
        Q(last_login__lt=cutoff) | Q(last_login__isnull=True, date_joined__lt=cutoff)
    )

    created_count = 0
    for user_id in users.values_list("id", flat=True):
        if _has_recent_notification(
            user_id=user_id,
            notification_type=Notification.Type.RECOMMENDATION,
            text=INACTIVE_NOTIFICATION_TEXT,
            cooldown_hours=cooldown_hours,
        ):
            continue
        create_notification_for_user(
            user_id=user_id,
            notification_type=Notification.Type.RECOMMENDATION,
            text=INACTIVE_NOTIFICATION_TEXT,
            action_url="/discover",
        )
        created_count += 1

    return created_count


def trigger_high_compatibility_match_notifications(
    *,
    minimum_score: int = 85,
    lookback_hours: int = 24,
    cooldown_hours: int = 24,
) -> int:
    """
    Notify users when new high-compatibility matches are found.
    """
    cutoff = timezone.now() - timedelta(hours=max(1, lookback_hours))
    matches = (
        Match.objects.filter(
            final_score__gte=max(0, min(int(minimum_score), 100)),
        )
        .filter(Q(created_at__gte=cutoff) | Q(updated_at__gte=cutoff))
        .select_related("user_a", "user_b")
        .order_by("-updated_at")
    )

    created_count = 0
    for match in matches:
        payload = (
            (match.user_a_id, match.user_b.name or "your match"),
            (match.user_b_id, match.user_a.name or "your match"),
        )
        for user_id, partner_name in payload:
            text = f"A new person you may connect with: {partner_name} ✨"
            if _has_recent_notification(
                user_id=user_id,
                notification_type=Notification.Type.MATCH,
                text=text,
                cooldown_hours=cooldown_hours,
            ):
                continue
            create_notification_for_user(
                user_id=user_id,
                notification_type=Notification.Type.MATCH,
                text=text,
                action_url=f"/chat/{match.id}",
                actor_name=partner_name,
            )
            created_count += 1

    return created_count


def trigger_unread_message_notifications(
    *,
    cooldown_hours: int = 24,
) -> int:
    """
    Notify users who currently have unread chat messages.
    """
    unread_recipient_ids = (
        Message.objects.filter(is_read=False)
        .annotate(
            recipient_user_id=Case(
                When(sender_id=F("match__user_a_id"), then=F("match__user_b_id")),
                default=F("match__user_a_id"),
                output_field=IntegerField(),
            )
        )
        .values_list("recipient_user_id", flat=True)
        .distinct()
    )

    created_count = 0
    for user_id in unread_recipient_ids:
        if _has_recent_notification(
            user_id=user_id,
            notification_type=Notification.Type.MESSAGE,
            text=UNREAD_MESSAGE_NOTIFICATION_TEXT,
            cooldown_hours=cooldown_hours,
        ):
            continue
        create_notification_for_user(
            user_id=user_id,
            notification_type=Notification.Type.MESSAGE,
            text=UNREAD_MESSAGE_NOTIFICATION_TEXT,
            action_url="/chat",
        )
        created_count += 1

    return created_count


def run_reengagement_triggers() -> Dict[str, int]:
    """
    Execute all re-engagement triggers and return counts.
    """
    inactive = trigger_inactive_user_notifications(inactive_hours=24, cooldown_hours=24)
    high_match = trigger_high_compatibility_match_notifications(
        minimum_score=85,
        lookback_hours=24,
        cooldown_hours=24,
    )
    unread = trigger_unread_message_notifications(cooldown_hours=24)
    return {
        "inactive_24h_notifications": inactive,
        "high_compatibility_notifications": high_match,
        "unread_message_notifications": unread,
    }
