from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GameNightWindow


class WindowSerializer(serializers.ModelSerializer):
    weekday_name = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = GameNightWindow
        fields = ("id", "weekday", "weekday_name", "start_time", "end_time", "timezone_name", "is_enabled")

    def validate_timezone_name(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError("Use a valid IANA timezone, such as Asia/Kolkata.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
        zone = attrs.get("timezone_name", getattr(self.instance, "timezone_name", None))
        if start and end and start >= end:
            raise serializers.ValidationError("End time must be later than start time on the same day.")
        others = GameNightWindow.objects.filter(weekday=weekday, timezone_name=zone)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if start and end and others.filter(start_time__lt=end, end_time__gt=start).exists():
            raise serializers.ValidationError("This window overlaps another window on the same day and timezone.")
        return attrs


class GameNightAdminWindowsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response(WindowSerializer(GameNightWindow.objects.all(), many=True).data)

    def post(self, request):
        serializer = WindowSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GameNightAdminWindowView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, window_id):
        window = get_object_or_404(GameNightWindow, pk=window_id)
        serializer = WindowSerializer(window, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, window_id):
        get_object_or_404(GameNightWindow, pk=window_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
