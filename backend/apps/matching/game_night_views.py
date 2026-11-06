from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .game_night import (
    join_queue, leave_queue, play_action, queue_status, room_payload,
    schedule_snapshot, send_message, vote_on_room,
)
from .models import GameNightReport, GameNightSession


class GameNightScheduleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(schedule_snapshot())


class GameNightQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(queue_status(request.user))

    def post(self, request):
        return Response(join_queue(request.user))

    def delete(self, request):
        leave_queue(request.user)
        return Response({"state": "idle"})


class GameNightRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_id):
        room = get_object_or_404(GameNightSession.objects.select_related("user_a", "user_b"), pk=room_id)
        return Response(room_payload(room, request.user))


class GameNightMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(GameNightSession, pk=room_id)
        return Response(send_message(room, request.user, request.data.get("content")))


class GameNightActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(GameNightSession, pk=room_id)
        return Response(play_action(room, request.user, request.data.get("content")))


class GameNightVoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(GameNightSession, pk=room_id)
        return Response(vote_on_room(room, request.user, request.data.get("choice")))


class GameNightReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(GameNightSession, pk=room_id)
        if request.user.id not in (room.user_a_id, room.user_b_id):
            return Response({"detail": "This is not your game room."}, status=status.HTTP_403_FORBIDDEN)
        reason = str(request.data.get("reason") or "Safety concern").strip()[:500]
        GameNightReport.objects.get_or_create(session=room, reporter=request.user, defaults={"reason": reason})
        if room.status == GameNightSession.Status.ACTIVE:
            vote_on_room(room, request.user, "pass")
        return Response({"detail": "Report submitted. This room is closed for you."}, status=status.HTTP_201_CREATED)
