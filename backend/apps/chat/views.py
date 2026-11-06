from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.games.models import GameSession
from apps.services.utils.pagination import StandardResultsSetPagination
from apps.matching.models import Match
from apps.matching.safety_views import is_blocked_between, is_user_restricted
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
    match = get_object_or_404(
        Match.objects.filter(status=Match.Status.MATCHED, is_visible=True).filter(Q(user_a=user) | Q(user_b=user)),
        id=match_id,
    )
    if is_blocked_between(match.user_a_id, match.user_b_id):
        from django.http import Http404
        raise Http404("This conversation is no longer available.")
    if is_user_restricted(user.id, "messaging"):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Messaging is temporarily restricted on this account.")
    return match


class MatchMessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id: int):
        match = _get_authorized_match_or_404(match_id, request.user)

        mark_read = request.query_params.get("mark_read", "true").strip().lower() not in {"0", "false", "no"}
        if mark_read:
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

        messages = Message.objects.filter(match=match).select_related("sender", "reply_to").order_by("created_at")
        payload = MessageSerializer(messages, many=True).data
        session_ids = {
            int(message.get("game_payload", {}).get("session_id"))
            for message in payload
            if message.get("game_payload", {}).get("session_id")
        }
        status_by_session = dict(GameSession.objects.filter(match=match, id__in=session_ids).values_list("id", "status"))
        status_to_invite = {
            GameSession.Status.INVITED: "pending",
            GameSession.Status.ACTIVE: "accepted",
            GameSession.Status.COMPLETED: "accepted",
            GameSession.Status.DECLINED: "declined",
            GameSession.Status.EXPIRED: "expired",
        }
        for message in payload:
            game_payload = message.get("game_payload") or {}
            session_id = game_payload.get("session_id")
            if session_id and int(session_id) in status_by_session:
                game_payload.setdefault("invite_status", status_to_invite.get(status_by_session[int(session_id)]))
        return Response(payload, status=status.HTTP_200_OK)


class MatchMessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "chat_message"

    def post(self, request, match_id: int):
        match = _get_authorized_match_or_404(match_id, request.user)
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client_message_id = serializer.validated_data.get("client_message_id")
        reply_to_id = serializer.validated_data.get("reply_to_id")
        if reply_to_id and not Message.objects.filter(
            id=reply_to_id, match=match, message_type=Message.MessageType.TEXT
        ).exists():
            return Response({"reply_to_id": ["Message not found in this chat."]}, status=status.HTTP_400_BAD_REQUEST)

        message_data = {
            "content": serializer.validated_data["content"].strip(),
            "message_type": Message.MessageType.TEXT,
            "game_payload": {},
            "reply_to_id": reply_to_id,
            "status": Message.Status.DELIVERED,
            "is_read": False,
        }
        if client_message_id:
            message, created = Message.objects.get_or_create(
                match=match,
                sender=request.user,
                client_message_id=client_message_id,
                defaults=message_data,
            )
            if not created and (
                message.content != message_data["content"]
                or message.reply_to_id != reply_to_id
            ):
                return Response(
                    {"client_message_id": ["This message retry key was already used for different content."]},
                    status=status.HTTP_409_CONFLICT,
                )
        else:
            message = Message.objects.create(match=match, sender=request.user, **message_data)
            created = True

        if created:
            recipient_user_id = match.user_b_id if match.user_a_id == request.user.id else match.user_a_id
            notify_new_message(recipient_user_id=recipient_user_id, sender_name=request.user.name, match_id=match.id)
        payload = MessageSerializer(message).data
        if created:
            safe_group_send(
                f"match_{match.id}",
                {
                    "type": "ws.event",
                    "event": "new_message",
                    "data": payload,
                },
            )
        return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MatchMessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    ALLOWED = {"❤️", "😂", "✨", "👍", "😮"}

    def post(self, request, match_id: int, message_id: int):
        match = _get_authorized_match_or_404(match_id, request.user)
        emoji = request.data.get("emoji")
        if emoji not in self.ALLOWED:
            return Response({"emoji": ["Choose a supported reaction."]}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            message = get_object_or_404(
                Message.objects.select_for_update(), id=message_id, match=match,
                message_type=Message.MessageType.TEXT,
            )
            reactions = {key: list(value) for key, value in (message.reactions or {}).items() if isinstance(value, list)}
            user_id = request.user.id
            current = reactions.get(emoji, [])
            if user_id in current:
                current.remove(user_id)
            else:
                current.append(user_id)
            if current:
                reactions[emoji] = current
            else:
                reactions.pop(emoji, None)
            message.reactions = reactions
            message.save(update_fields=["reactions"])
        payload = {"message_id": message.id, "reactions": message.reactions}
        safe_group_send(f"match_{match.id}", {"type": "ws.event", "event": "message_reactions", "data": payload})
        return Response(payload, status=status.HTTP_200_OK)
