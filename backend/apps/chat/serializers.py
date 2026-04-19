from rest_framework import serializers

from .models import ChatMessage, Message


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "message", "created_at"]
        read_only_fields = ["id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    sender_id = serializers.IntegerField(read_only=True)
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "sender_id",
            "content",
            "message_type",
            "game_payload",
            "timestamp",
            "status",
            "is_read",
        ]
        read_only_fields = [
            "id",
            "sender_id",
            "message_type",
            "game_payload",
            "timestamp",
            "status",
            "is_read",
        ]


class MessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(allow_blank=False, max_length=5000)
    client_message_id = serializers.CharField(required=False, allow_blank=False, max_length=64)
