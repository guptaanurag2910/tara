from django.contrib import admin

from .models import DailyRecommendation, Match, MatchResult, Swipe

admin.site.register(MatchResult)


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


@admin.register(Swipe)
class SwipeAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "target_user", "action", "updated_at")
    list_filter = ("action",)
    search_fields = ("user__email", "target_user__email", "user__name", "target_user__name")


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
