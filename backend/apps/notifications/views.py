from rest_framework import generics, permissions, status
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
