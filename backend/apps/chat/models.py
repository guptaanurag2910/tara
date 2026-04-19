from django.conf import settings
from django.db import models


class ChatMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user}: {self.message[:30]}"


class Message(models.Model):
    class Status(models.TextChoices):
        SENT = "sent", "Sent"
        DELIVERED = "delivered", "Delivered"
        READ = "read", "Read"

    class MessageType(models.TextChoices):
        TEXT = "text", "Text"
        GAME_EVENT = "game_event", "Game Event"

    match = models.ForeignKey(
        "matching.Match",
        on_delete=models.CASCADE,
        related_name="messages",
        db_index=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    content = models.TextField()
    message_type = models.CharField(
        max_length=24,
        choices=MessageType.choices,
        default=MessageType.TEXT,
        db_index=True,
    )
    game_payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.SENT,
        db_index=True,
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["match"], name="chat_message_match_idx"),
            models.Index(fields=["match", "created_at"], name="chat_message_match_created_idx"),
        ]

    def __str__(self) -> str:
        return (
            f"Match {self.match_id} | {self.sender_id} "
            f"[{self.message_type}]: {self.content[:30]}"
        )
