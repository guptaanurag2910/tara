from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Match(models.Model):
    class Status(models.TextChoices):
        MATCHED = "matched", "Matched"
        BLOCKED = "blocked", "Blocked"

    user_a = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="realtime_matches_as_a",
    )
    user_b = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="realtime_matches_as_b",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.MATCHED,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~Q(user_a=F("user_b")),
                name="realtime_match_users_must_differ",
            ),
            models.CheckConstraint(
                check=Q(user_a__lt=F("user_b")),
                name="realtime_match_pair_ordered",
            ),
            models.UniqueConstraint(
                fields=["user_a", "user_b"],
                name="realtime_match_unique_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["user_a", "status"], name="rt_match_user_a_status_idx"),
            models.Index(fields=["user_b", "status"], name="rt_match_user_b_status_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Match({self.user_a_id}<->{self.user_b_id}, status={self.status})"


class Message(models.Model):
    class MessageType(models.TextChoices):
        TEXT = "text", "Text"
        GAME_START = "game_start", "Game Start"
        GAME_RESULT = "game_result", "Game Result"

    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name="messages",
        db_index=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="realtime_sent_messages",
    )
    type = models.CharField(
        max_length=24,
        choices=MessageType.choices,
        default=MessageType.TEXT,
        db_index=True,
    )
    content = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["match", "created_at"], name="rt_message_match_created_idx"),
            models.Index(fields=["match", "is_read"], name="rt_message_match_read_idx"),
            models.Index(fields=["sender", "created_at"], name="rt_message_sender_created_idx"),
        ]
        ordering = ["created_at"]

    def __str__(self) -> str:
        return (
            f"Message(match={self.match_id}, sender={self.sender_id}, "
            f"type={self.type}, read={self.is_read})"
        )

