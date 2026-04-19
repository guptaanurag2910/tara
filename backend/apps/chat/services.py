from typing import Any

from .models import Message
from .realtime import safe_group_send
from .serializers import MessageSerializer


def create_game_event_message(
    *,
    match_id: int,
    sender_id: int,
    content: str,
    event_type: str,
    payload: dict[str, Any] | None = None,
    dedupe_key: str | None = None,
    broadcast: bool = True,
) -> Message:
    """
    Persist a game event as a special chat message and optionally broadcast it.
    """
    game_payload: dict[str, Any] = dict(payload or {})
    game_payload["event_type"] = event_type
    if dedupe_key:
        game_payload["event_id"] = dedupe_key

    message = None
    if dedupe_key:
        message = (
            Message.objects.filter(
                match_id=match_id,
                message_type=Message.MessageType.GAME_EVENT,
                game_payload__event_id=dedupe_key,
            )
            .order_by("-id")
            .first()
        )

    if message is None:
        message = Message.objects.create(
            match_id=match_id,
            sender_id=sender_id,
            content=content.strip(),
            message_type=Message.MessageType.GAME_EVENT,
            game_payload=game_payload,
            status=Message.Status.DELIVERED,
            is_read=False,
        )

    if broadcast:
        safe_group_send(
            f"chat_match_{match_id}",
            {
                "type": "chat.message",
                "payload": MessageSerializer(message).data,
            },
        )

    return message
