from django.contrib import admin

from .models import ChatMessage, Message

admin.site.register(ChatMessage)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "match", "sender", "message_type", "status", "is_read", "created_at")
    list_filter = ("message_type", "status", "is_read", "created_at")
    search_fields = ("content", "sender__email", "sender__name")
