from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q


class MatchResult(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    partner_name = models.CharField(max_length=255)
    score = models.PositiveSmallIntegerField()
    reasoning = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user} -> {self.partner_name} ({self.score})"


class Match(models.Model):
    class Status(models.TextChoices):
        SUGGESTED = "suggested", "Suggested"
        LIKED = "liked", "Liked"
        MATCHED = "matched", "Matched"
        REJECTED = "rejected", "Rejected"

    user_a = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="matches_as_a",
    )
    user_b = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="matches_as_b",
    )
    kundali_score = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(36)]
    )
    personality_score = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    final_score = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    match_type = models.CharField(max_length=64)
    insight_text = models.TextField(blank=True)
    is_visible = models.BooleanField(default=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.SUGGESTED,
        db_index=True,
    )
    matched_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~Q(user_a=F("user_b")),
                name="matching_match_users_must_differ",
            ),
            models.CheckConstraint(
                check=Q(user_a__lt=F("user_b")),
                name="matching_match_user_pair_ordered",
            ),
            models.UniqueConstraint(
                fields=["user_a", "user_b"],
                name="matching_unique_user_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["user_a"], name="matching_match_user_a_idx"),
            models.Index(fields=["user_b"], name="matching_match_user_b_idx"),
            models.Index(fields=["final_score"], name="matching_match_final_score_idx"),
            models.Index(fields=["user_a", "status"], name="matching_u_a_status_idx"),
            models.Index(fields=["user_b", "status"], name="matching_u_b_status_idx"),
            models.Index(fields=["status", "-final_score"], name="matching_status_score_idx"),
        ]
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return (
            f"{self.user_a_id}<->{self.user_b_id} "
            f"{self.final_score}% ({self.get_status_display()})"
        )


class Swipe(models.Model):
    class Action(models.TextChoices):
        LIKE = "like", "Like"
        PASS = "pass", "Pass"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="swipes_sent",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="swipes_received",
    )
    action = models.CharField(max_length=8, choices=Action.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~Q(user=F("target_user")),
                name="matching_swipe_users_must_differ",
            ),
            models.UniqueConstraint(
                fields=["user", "target_user"],
                name="matching_unique_swipe_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "action"], name="matching_swipe_user_action_idx"),
            models.Index(fields=["target_user", "action"], name="mtch_swipe_tgt_act_idx"),
        ]
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.user_id}->{self.target_user_id} ({self.action})"


class RecommendationQueue(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommendation_queue_items",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommended_queue_targets",
    )
    processed = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~Q(user=F("target_user")),
                name="matching_reco_queue_users_must_differ",
            ),
            models.UniqueConstraint(
                fields=["user", "target_user"],
                name="matching_reco_queue_unique_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["user"], name="matching_reco_queue_user_idx"),
            models.Index(fields=["target_user"], name="mtch_reco_queue_target_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Queue {self.user_id} -> {self.target_user_id} (processed={self.processed})"


class DailyRecommendation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_recommendations",
    )
    recommended_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommended_to",
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~Q(user=F("recommended_user")),
                name="matching_daily_rec_users_must_differ",
            ),
            models.UniqueConstraint(
                fields=["user", "recommended_user"],
                name="matching_daily_rec_unique_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-score"], name="mtch_drec_user_score_idx"),
            models.Index(fields=["recommended_user"], name="mtch_drec_reco_user_idx"),
        ]
        ordering = ["-score", "id"]

    def __str__(self) -> str:
        return f"{self.user_id} -> {self.recommended_user_id} ({self.score})"
