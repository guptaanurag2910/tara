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
        UNMATCHED = "unmatched", "Unmatched"
        BLOCKED = "blocked", "Blocked"

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
    note = models.CharField(max_length=280, blank=True, default="")
    note_delivered_at = models.DateTimeField(null=True, blank=True)
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
    class Status(models.TextChoices):
        READY = "ready", "Ready"
        SHOWN = "shown", "Shown"
        ACTED = "acted", "Acted"

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
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.READY, db_index=True)
    kundali_score = models.FloatField(default=0)
    personality_score = models.FloatField(default=0)
    final_score = models.FloatField(default=0)
    match_type = models.CharField(max_length=64, blank=True, default="")
    insight_text = models.TextField(blank=True, default="")
    shown_at = models.DateTimeField(null=True, blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
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
            models.Index(fields=["user", "status", "-final_score", "id"], name="mtch_rq_usr_score_idx"),
        ]
        ordering = ["-final_score", "id"]

    def __str__(self) -> str:
        return f"Queue {self.user_id} -> {self.target_user_id} ({self.status}, {self.final_score})"


class RecommendationGenerationJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recommendation_generation_job",
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    cursor_id = models.PositiveBigIntegerField(default=0)
    candidates_scanned = models.PositiveIntegerField(default=0)
    initial_target = models.PositiveIntegerField(default=3000)
    batch_size = models.PositiveSmallIntegerField(default=200)
    attempts = models.PositiveSmallIntegerField(default=0)
    locked_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "updated_at"], name="mtch_rgj_stat_upd_idx")]

    def __str__(self) -> str:
        return f"Recommendation generation for {self.user_id} ({self.status})"


class GameNightWindow(models.Model):
    WEEKDAYS = [(index, name) for index, name in enumerate(
        ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    )]

    weekday = models.PositiveSmallIntegerField(choices=WEEKDAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()
    timezone_name = models.CharField(max_length=64, default="Asia/Kolkata")
    is_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["weekday", "start_time", "timezone_name"],
                name="matching_game_night_unique_window",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_weekday_display()} {self.start_time:%H:%M}-{self.end_time:%H:%M} ({self.timezone_name})"


class GameNightEntry(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_night_entry"
    )
    session = models.ForeignKey(
        "GameNightSession", on_delete=models.SET_NULL, null=True, blank=True, related_name="queue_entries"
    )
    is_waiting = models.BooleanField(default=False, db_index=True)
    last_seen_at = models.DateTimeField()
    window_ends_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["is_waiting", "last_seen_at"], name="mtch_gn_wait_seen_idx")]


class GameNightSession(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MATCHED = "matched", "Matched"
        PASSED = "passed", "Passed"
        EXPIRED = "expired", "Expired"

    user_a = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_night_as_a")
    user_b = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_night_as_b")
    game_kind = models.CharField(max_length=32)
    game_state = models.JSONField(default=dict)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    vote_a = models.CharField(max_length=8, blank=True)
    vote_b = models.CharField(max_length=8, blank=True)
    match = models.ForeignKey("Match", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    play_ends_at = models.DateTimeField()
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(check=~Q(user_a=F("user_b")), name="mtch_gn_users_differ"),
        ]


class GameNightMessage(models.Model):
    session = models.ForeignKey(GameNightSession, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class GameNightReport(models.Model):
    session = models.ForeignKey(GameNightSession, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["session", "reporter"], name="mtch_gn_unique_report")]


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


class UserBlock(models.Model):
    """A directional user block; the restriction is enforced for both users."""

    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="safety_blocks_created")
    blocked_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="safety_blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=~Q(blocker=F("blocked_user")), name="safety_block_users_differ"),
            models.UniqueConstraint(fields=["blocker", "blocked_user"], name="safety_unique_directed_block"),
        ]
        indexes = [models.Index(fields=["blocked_user", "created_at"], name="safety_blk_tgt_created_idx")]

    def __str__(self) -> str:
        return f"{self.blocker_id} blocks {self.blocked_user_id}"


class SafetyReport(models.Model):
    class Category(models.TextChoices):
        HARASSMENT = "harassment", "Harassment"
        IMPERSONATION = "impersonation", "Impersonation"
        SCAM = "scam", "Scam"
        UNSAFE_CONTENT = "unsafe_content", "Unsafe content"
        UNDERAGE = "underage", "Underage user"
        OTHER = "other", "Other"

    class TargetType(models.TextChoices):
        PROFILE = "profile", "Profile"
        CHAT_MESSAGE = "chat_message", "Chat message"
        CONVERSATION = "conversation", "Conversation"
        GAME_SESSION = "game_session", "Game session"
        GAME_NIGHT = "game_night", "Game Night room"
        PROFILE_PHOTO = "profile_photo", "Profile photo"
        GAME_PHOTO = "game_photo", "Game photo"

    class Priority(models.TextChoices):
        URGENT = "urgent", "Urgent"
        STANDARD = "standard", "Standard"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        IN_REVIEW = "in_review", "In review"
        ACTIONED = "actioned", "Actioned"
        CLOSED = "closed", "Closed"

    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="safety_reports_filed")
    reported_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="safety_reports_about")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="safety_reports_assigned")
    category = models.CharField(max_length=24, choices=Category.choices, db_index=True)
    target_type = models.CharField(max_length=24, choices=TargetType.choices)
    target_id = models.CharField(max_length=64)
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.STANDARD, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RECEIVED, db_index=True)
    details = models.CharField(max_length=1000, blank=True)
    evidence_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["priority", "created_at"]
        indexes = [models.Index(fields=["status", "priority", "created_at"], name="safety_report_queue_idx")]

    def __str__(self) -> str:
        return f"Report {self.pk}: {self.category} ({self.status})"


class DatePlan(models.Model):
    match = models.OneToOneField(Match, on_delete=models.CASCADE, related_name="date_plan")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="date_plans_created")
    activity = models.CharField(max_length=160)
    scheduled_at = models.DateTimeField()
    public_venue = models.CharField(max_length=255)
    is_public_venue = models.BooleanField(default=False)
    share_with_trusted_contact = models.BooleanField(default=False)
    trusted_contact_name = models.CharField(max_length=120, blank=True)
    trusted_contact_phone = models.CharField(max_length=20, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


class DateSafetyCheckIn(models.Model):
    class Status(models.TextChoices):
        SAFE = "safe", "Safe"
        CONCERN = "concern", "Concern"

    plan = models.ForeignKey(DatePlan, on_delete=models.CASCADE, related_name="checkins")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="date_safety_checkins")
    status = models.CharField(max_length=12, choices=Status.choices)
    details = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["plan", "user"], name="matching_date_checkin_unique_user")]


class ModerationAction(models.Model):
    class ActionType(models.TextChoices):
        WARNING = "warning", "Warning"
        RESTRICTION = "restriction", "Temporary restriction"
        SUSPENSION = "suspension", "Suspension"
        BAN = "ban", "Permanent ban"
        REINSTATEMENT = "reinstatement", "Reinstatement"

    report = models.ForeignKey(SafetyReport, null=True, blank=True, on_delete=models.SET_NULL, related_name="actions")
    subject = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="moderation_actions_received")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="moderation_actions_taken")
    action_type = models.CharField(max_length=20, choices=ActionType.choices)
    reason_code = models.CharField(max_length=40)
    scope = models.CharField(max_length=32, blank=True)
    notes = models.CharField(max_length=1000, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reversed_at = models.DateTimeField(null=True, blank=True)
    reversed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="moderation_actions_reversed")
    reversal_reason = models.CharField(max_length=1000, blank=True)

    class Meta:
        ordering = ["-created_at"]


class SafetyAppeal(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        IN_REVIEW = "in_review", "In review"
        UPHELD = "upheld", "Upheld"
        OVERTURNED = "overturned", "Overturned"

    action = models.ForeignKey(ModerationAction, on_delete=models.CASCADE, related_name="appeals")
    appellant = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="safety_appeals")
    statement = models.CharField(max_length=2000)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUBMITTED, db_index=True)
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="safety_appeals_reviewed")
    outcome_note = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)


class SafetyAuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="safety_audit_events")
    report = models.ForeignKey(SafetyReport, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_events")
    action = models.CharField(max_length=40, db_index=True)
    subject_user_id = models.BigIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"], name="safety_audit_action_idx")]
