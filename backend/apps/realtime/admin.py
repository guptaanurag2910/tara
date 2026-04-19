from django.contrib import admin

from .models import Match, Message


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("id", "user_a", "user_b", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user_a__email", "user_b__email", "user_a__name", "user_b__name")
    ordering = ("-created_at",)
    list_select_related = ("user_a", "user_b")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "match", "sender", "type", "is_read", "created_at")
    list_filter = ("type", "is_read", "created_at")
    search_fields = ("sender__email", "sender__name", "match__id")
    ordering = ("-created_at",)
    list_select_related = ("match", "sender")

