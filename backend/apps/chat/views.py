from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.services.utils.pagination import StandardResultsSetPagination
from apps.matching.models import Match
from apps.notifications.services import notify_new_message

from .models import ChatMessage, Message
from .realtime import safe_group_send
from .serializers import ChatMessageSerializer, MessageCreateSerializer, MessageSerializer


class ChatMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatMessageSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return ChatMessage.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


def _get_authorized_match_or_404(match_id: int, user):
    return get_object_or_404(
        Match.objects.filter(status=Match.Status.MATCHED).filter(Q(user_a=user) | Q(user_b=user)),
        id=match_id,
    )


class MatchMessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id: int):
        match = _get_authorized_match_or_404(match_id, request.user)

        unread_incoming_qs = Message.objects.filter(
            match=match,
            is_read=False,
        ).exclude(sender=request.user)
        unread_ids = list(unread_incoming_qs.values_list("id", flat=True))
        if unread_ids:
            unread_incoming_qs.update(
                is_read=True,
                status=Message.Status.READ,
            )
            safe_group_send(
                f"chat_match_{match.id}",
                {
                    "type": "chat.receipt",
                    "payload": {
                        "event": "read_receipt",
                        "match_id": match.id,
                        "message_ids": unread_ids,
                        "status": Message.Status.READ,
                        "reader_id": request.user.id,
                    },
                },
            )

        messages = Message.objects.filter(match=match).select_related("sender").order_by("created_at")
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MatchMessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, match_id: int):
        match = _get_authorized_match_or_404(match_id, request.user)
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client_message_id = serializer.validated_data.get("client_message_id")

        message = Message.objects.create(
            match=match,
            sender=request.user,
            content=serializer.validated_data["content"].strip(),
            message_type=Message.MessageType.TEXT,
            game_payload={},
            status=Message.Status.DELIVERED,
            is_read=False,
        )
        recipient_user_id = match.user_b_id if match.user_a_id == request.user.id else match.user_a_id
        notify_new_message(recipient_user_id=recipient_user_id)
        payload = MessageSerializer(message).data
        if client_message_id:
            payload["client_message_id"] = client_message_id
        safe_group_send(
            f"match_{match.id}",
            {
                "type": "ws.event",
                "event": "new_message",
                "data": payload,
            },
        )
        return Response(payload, status=status.HTTP_201_CREATED)
