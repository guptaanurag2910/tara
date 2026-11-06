from django.contrib import admin
from django import forms
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .models import (
    DailyRecommendation, GameNightEntry, GameNightReport, GameNightSession, GameNightWindow,
    Match, MatchResult, ModerationAction, RecommendationGenerationJob, RecommendationQueue,
    SafetyAppeal, SafetyAuditEvent, SafetyReport, Swipe, UserBlock,
)


class GameNightWindowForm(forms.ModelForm):
    class Meta:
        model = GameNightWindow
        fields = "__all__"

    def clean(self):
        data = super().clean()
        if data.get("start_time") and data.get("end_time") and data["start_time"] >= data["end_time"]:
            raise forms.ValidationError("End time must be later than start time on the same day.")
        try:
            ZoneInfo(data.get("timezone_name", ""))
        except (ZoneInfoNotFoundError, ValueError):
            raise forms.ValidationError("Enter a valid IANA timezone, such as Asia/Kolkata.")
        if all(data.get(key) is not None for key in ("weekday", "start_time", "end_time", "timezone_name")):
            others = GameNightWindow.objects.filter(
                weekday=data["weekday"], timezone_name=data["timezone_name"],
                start_time__lt=data["end_time"], end_time__gt=data["start_time"],
            )
            if self.instance.pk:
                others = others.exclude(pk=self.instance.pk)
            if others.exists():
                raise forms.ValidationError("This window overlaps another window on the same day and timezone.")
        return data


@admin.register(GameNightWindow)
class GameNightWindowAdmin(admin.ModelAdmin):
    form = GameNightWindowForm
    list_display = ("weekday", "start_time", "end_time", "timezone_name", "is_enabled")
    list_editable = ("is_enabled",)
    list_filter = ("is_enabled", "timezone_name")


@admin.register(GameNightSession)
class GameNightSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user_a", "user_b", "game_kind", "status", "created_at")
    list_filter = ("status", "game_kind")
    readonly_fields = ("user_a", "user_b", "game_kind", "game_state", "status", "vote_a", "vote_b", "match", "created_at", "play_ends_at", "expires_at")


@admin.register(GameNightReport)
class GameNightReportAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "reporter", "reason", "created_at")
    readonly_fields = ("session", "reporter", "reason", "created_at")


@admin.register(GameNightEntry)
class GameNightEntryAdmin(admin.ModelAdmin):
    list_display = ("user", "is_waiting", "last_seen_at", "window_ends_at", "session")
    readonly_fields = ("user", "is_waiting", "last_seen_at", "window_ends_at", "session")

admin.site.register(MatchResult)


@admin.register(SafetyReport)
class SafetyReportAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "priority", "status", "target_type", "reporter", "reported_user", "assigned_to", "created_at")
    list_filter = ("priority", "status", "category", "target_type", "created_at")
    search_fields = ("details", "target_id", "reporter__email", "reported_user__email", "reporter__name", "reported_user__name")
    readonly_fields = tuple(field.name for field in SafetyReport._meta.fields)
    list_select_related = ("reporter", "reported_user", "assigned_to")
    list_per_page = 50

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ("id", "action_type", "reason_code", "subject", "actor", "report", "created_at", "expires_at")
    list_filter = ("action_type", "reason_code", "created_at")
    search_fields = ("subject__email", "subject__name", "reason_code", "report__id")
    readonly_fields = tuple(field.name for field in ModerationAction._meta.fields)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SafetyAppeal)
class SafetyAppealAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "appellant", "reviewer", "action", "created_at", "updated_at")
    list_filter = ("status", "created_at")
    search_fields = ("appellant__email", "appellant__name", "statement")
    readonly_fields = ("action", "appellant", "statement", "created_at")


@admin.register(SafetyAuditEvent)
class SafetyAuditEventAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "actor", "subject_user_id", "report", "created_at")
    list_filter = ("action", "created_at")
    readonly_fields = tuple(field.name for field in SafetyAuditEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ("id", "blocker", "blocked_user", "created_at")
    search_fields = ("blocker__email", "blocked_user__email", "blocker__name", "blocked_user__name")
    readonly_fields = tuple(field.name for field in UserBlock._meta.fields)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user_a",
        "user_b",
        "kundali_score",
        "personality_score",
        "final_score",
        "status",
        "matched_at",
        "updated_at",
    )
    list_filter = ("status", "match_type")
    search_fields = ("user_a__email", "user_b__email", "user_a__name", "user_b__name", "match_type")
    list_select_related = ("user_a", "user_b")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 50


@admin.register(Swipe)
class SwipeAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "target_user", "action", "updated_at")
    list_filter = ("action",)
    search_fields = ("user__email", "target_user__email", "user__name", "target_user__name")
    date_hierarchy = "updated_at"
    list_select_related = ("user", "target_user")
    list_per_page = 50


@admin.register(DailyRecommendation)
class DailyRecommendationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "recommended_user", "score", "created_at")
    list_filter = ("created_at",)
    search_fields = (
        "user__email",
        "user__name",
        "recommended_user__email",
        "recommended_user__name",
    )
    list_select_related = ("user", "recommended_user")
    list_per_page = 50


@admin.register(RecommendationQueue)
class RecommendationQueueAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "target_user", "final_score", "status", "shown_at", "acted_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__name", "target_user__name", "user__email", "target_user__email")
    list_select_related = ("user", "target_user")
    list_per_page = 50


@admin.register(RecommendationGenerationJob)
class RecommendationGenerationJobAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "candidates_scanned", "initial_target", "attempts", "updated_at")
    list_filter = ("status", "updated_at")
    search_fields = ("user__name", "user__email")
    list_select_related = ("user",)
    readonly_fields = ("created_at", "updated_at", "locked_at", "last_error")
    list_per_page = 50
