from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationReadSerializer, NotificationSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = NotificationReadSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        notification_ids = serializer.validated_data.get("notification_ids")
        queryset = Notification.objects.filter(user=request.user, is_read=False)
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)

        updated = queryset.update(is_read=True)
        return Response({"updated": updated}, status=status.HTTP_200_OK)


class NotificationPreferencesSerializer(serializers.Serializer):
    matches = serializers.BooleanField(required=False)
    messages = serializers.BooleanField(required=False)
    game_turns = serializers.BooleanField(required=False)


class NotificationPreferencesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        preferences = request.user.notification_preferences or {}
        return Response(
            {
                "matches": preferences.get("matches", True),
                "messages": preferences.get("messages", True),
                "game_turns": preferences.get("game_turns", True),
            }
        )

    def patch(self, request):
        serializer = NotificationPreferencesSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        preferences = {
            "matches": True,
            "messages": True,
            "game_turns": True,
            **(request.user.notification_preferences or {}),
            **serializer.validated_data,
        }
        request.user.notification_preferences = preferences
        request.user.save(update_fields=["notification_preferences"])
        return Response(preferences)
