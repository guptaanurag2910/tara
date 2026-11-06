from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        MATCH = "match", "Match"
        MESSAGE = "message", "Message"
        GAME_TURN = "game_turn", "Game turn"
        RECOMMENDATION = "recommendation", "Recommendation"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=20, choices=Type.choices, db_index=True)
    text = models.TextField()
    action_url = models.CharField(max_length=255, blank=True, default="")
    actor_name = models.CharField(max_length=255, blank=True, default="")
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"], name="notif_user_read_created_idx"),
            models.Index(fields=["user", "type", "-created_at"], name="notif_user_type_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} {self.type}: {self.text[:40]}"
