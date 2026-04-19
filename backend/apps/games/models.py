from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class GameCategory(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    emoji = models.CharField(max_length=16, blank=True, default="")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class Game(models.Model):
    class Type(models.TextChoices):
        CHOICE = "choice", "Choice"
        TEXT = "text", "Text"
        QUIZ = "quiz", "Quiz"

    name = models.CharField(max_length=120, db_index=True)
    emoji = models.CharField(max_length=16, blank=True, default="")
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=Type.choices, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "id"]
        indexes = [
            models.Index(fields=["is_active", "type"], name="games_game_active_type_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_type_display()})"


class GameQuestion(models.Model):
    class GameType(models.TextChoices):
        THIS_OR_THAT = "this_or_that", "This or That"
        WOULD_YOU_RATHER = "would_you_rather", "Would You Rather"
        PREDICT_ME = "predict_me", "Predict Me"
        DEAL_BREAKER = "deal_breaker", "Deal Breaker"
        OPEN_ENDED = "open_ended", "Open Ended"

    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    category = models.ForeignKey(
        GameCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="questions",
    )
    game_type = models.CharField(
        max_length=32,
        choices=GameType.choices,
        default=GameType.THIS_OR_THAT,
        db_index=True,
    )
    question_text = models.TextField()
    options = models.JSONField(default=list, blank=True)
    trait_mapping = models.JSONField(default=dict, blank=True)
    tags = models.JSONField(default=list, blank=True)
    difficulty = models.PositiveSmallIntegerField(default=1)
    times_used = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False, db_index=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["game", "order"],
                name="games_unique_question_order_per_game",
            ),
        ]
        indexes = [
            models.Index(fields=["game", "is_active", "order"], name="games_q_game_active_order_idx"),
            models.Index(fields=["game", "order"], name="games_q_game_order_idx"),
            models.Index(fields=["category"], name="games_q_category_idx"),
            models.Index(fields=["game_type"], name="games_q_game_type_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_game_type_display()} | Q{self.id}"


class GameOption(models.Model):
    question = models.ForeignKey(
        GameQuestion,
        on_delete=models.CASCADE,
        related_name="choice_options",
    )
    option_text = models.CharField(max_length=255)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["question", "order"],
                name="games_unique_option_order_per_question",
            ),
        ]
        indexes = [
            models.Index(fields=["question", "order"], name="games_opt_question_order_idx"),
        ]

    def __str__(self) -> str:
        return f"Q{self.question_id} Option {self.order}"


class QuestionExposure(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="question_exposures",
    )
    question = models.ForeignKey(
        GameQuestion,
        on_delete=models.CASCADE,
        related_name="exposures",
    )
    seen_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-seen_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "question"],
                name="games_unique_user_question_exposure",
            )
        ]
        indexes = [
            models.Index(fields=["user", "seen_at"], name="games_qexp_user_seen_idx"),
            models.Index(fields=["question", "seen_at"], name="games_qexp_q_seen_idx"),
        ]

    def __str__(self) -> str:
        return f"user={self.user_id} question={self.question_id}"


class GameSession(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    match = models.ForeignKey(
        "matching.Match",
        on_delete=models.CASCADE,
        related_name="game_sessions",
    )
    category = models.ForeignKey(
        GameCategory,
        on_delete=models.CASCADE,
        related_name="sessions",
        null=True,
        blank=True,
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_game_sessions",
        null=True,
        blank=True,
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="started_game_sessions",
    )
    current_question_index = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["match", "game"],
                condition=Q(status="active"),
                name="games_one_active_session_per_match_game",
            ),
        ]
        indexes = [
            models.Index(fields=["match", "status"], name="games_session_match_status_idx"),
            models.Index(fields=["game", "status"], name="games_session_game_status_idx"),
        ]

    def __str__(self) -> str:
        return f"Session {self.id} | match={self.match_id} game={self.game_id}"

    def save(self, *args, **kwargs):
        if self.created_by_id is None and self.started_by_id is not None:
            self.created_by_id = self.started_by_id
        if self.started_by_id is None and self.created_by_id is not None:
            self.started_by_id = self.created_by_id
        super().save(*args, **kwargs)


class GameSessionQuestion(models.Model):
    session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name="session_questions",
    )
    question = models.ForeignKey(
        GameQuestion,
        on_delete=models.CASCADE,
        related_name="session_questions",
    )
    order = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(3)],
    )

    class Meta:
        ordering = ["session_id", "order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "order"],
                name="games_unique_session_question_order",
            ),
            models.UniqueConstraint(
                fields=["session", "question"],
                name="games_unique_question_per_session",
            ),
        ]
        indexes = [
            models.Index(fields=["session", "order"], name="games_sq_session_order_idx"),
            models.Index(fields=["question"], name="games_sq_question_idx"),
        ]

    def __str__(self) -> str:
        return f"Session {self.session_id} | Q{self.question_id} | #{self.order}"


class GameResponse(models.Model):
    session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="game_responses",
    )
    question = models.ForeignKey(
        GameQuestion,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    selected_option = models.ForeignKey(
        GameOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responses",
    )
    text_answer = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "user", "question"],
                name="games_unique_response_per_user_question_in_session",
            ),
        ]
        indexes = [
            models.Index(fields=["session", "question"], name="game_resp_sess_q_idx"),
            models.Index(fields=["session", "user"], name="games_resp_session_user_idx"),
        ]

    def __str__(self) -> str:
        return f"Session {self.session_id} | user={self.user_id} | question={self.question_id}"
