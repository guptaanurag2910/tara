from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.db import models, transaction

from apps.games.models import (
    GameCategory,
    GameOption,
    GameQuestion,
    GameResponse,
    GameSession,
    GameSessionQuestion,
)
from apps.games.services import calculate_game_result
from apps.matching.models import Match
from apps.notifications.services import notify_new_message
from apps.services.game_service import get_random_questions

from .models import Message
from .serializers import MessageSerializer

User = get_user_model()


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        raw_match_id = self.scope.get("url_route", {}).get("kwargs", {}).get("match_id")
        try:
            self.match_id = int(raw_match_id)
        except (TypeError, ValueError):
            await self.close(code=4400)
            return

        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        is_allowed = await self._user_can_access_match(self.match_id, user.id)
        if not is_allowed:
            await self.close(code=4403)
            return

        # Required group name for this socket contract.
        self.group_name = f"match_{self.match_id}"
        # Backward-compat group to keep existing broadcasts working.
        self.legacy_group_name = f"chat_match_{self.match_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.legacy_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        group_name = getattr(self, "group_name", None)
        legacy_group_name = getattr(self, "legacy_group_name", None)

        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)
        if legacy_group_name:
            await self.channel_layer.group_discard(legacy_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        event_name = str(content.get("event", "")).strip().lower()
        # Backward compatibility for plain chat payloads.
        if not event_name and content.get("content"):
            event_name = "send_message"

        data = content.get("data")
        if not isinstance(data, dict):
            data = content

        try:
            if event_name == "send_message":
                payload = await self._handle_send_message(user.id, data)
                await self._broadcast("new_message", payload)
                return

            if event_name == "start_game":
                payload = await self._handle_start_game(user.id, data)
                await self._broadcast("game_started", payload)
                return

            if event_name == "answer_question":
                result = await self._handle_answer_question(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            await self.send_json({"event": "error", "error": "Unsupported event."})
        except ValueError as exc:
            await self.send_json({"event": "error", "error": str(exc)})
        except Exception:
            await self.send_json({"event": "error", "error": "Unexpected server error."})

    async def _broadcast(self, event_name: str, data: dict[str, Any]):
        # Broadcast to the primary room.
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "ws.event",
                "event": event_name,
                "data": data,
            },
        )

    async def ws_event(self, event):
        await self.send_json(
            {
                "event": event.get("event"),
                "data": event.get("data", {}),
            }
        )

    async def chat_message(self, event):
        # Compatibility for existing code that sends {"type": "chat.message", "payload": ...}
        await self.send_json({"event": "new_message", "data": event["payload"]})

    async def chat_receipt(self, event):
        await self.send_json(event["payload"])

    @database_sync_to_async
    def _user_can_access_match(self, match_id: int, user_id: int) -> bool:
        return Match.objects.filter(id=match_id, status=Match.Status.MATCHED).filter(
            models.Q(user_a_id=user_id) | models.Q(user_b_id=user_id)
        ).exists()

    @database_sync_to_async
    def _handle_send_message(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        text = str(data.get("content", "")).strip()
        if not text:
            raise ValueError("content is required")

        client_message_id = data.get("client_message_id")
        if client_message_id is not None:
            client_message_id = str(client_message_id).strip() or None

        match = (
            Match.objects.only("id", "user_a_id", "user_b_id")
            .filter(id=self.match_id)
            .first()
        )
        if match is None:
            raise ValueError("Match not found.")
        if user_id not in {match.user_a_id, match.user_b_id}:
            raise ValueError("You are not part of this match.")

        message = Message.objects.create(
            match_id=self.match_id,
            sender_id=user_id,
            content=text,
            message_type=Message.MessageType.TEXT,
            game_payload={},
            status=Message.Status.DELIVERED,
            is_read=False,
        )

        recipient_user_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
        notify_new_message(recipient_user_id=recipient_user_id)

        payload = MessageSerializer(message).data
        payload["match_id"] = self.match_id
        if client_message_id:
            payload["client_message_id"] = client_message_id
        return payload

    @database_sync_to_async
    def _handle_start_game(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        category_slug = str(data.get("category", "")).strip()
        if not category_slug:
            raise ValueError("category is required")

        try:
            limit = int(data.get("limit", 3))
        except (TypeError, ValueError):
            limit = 3
        if limit <= 0:
            limit = 3

        with transaction.atomic():
            match = (
                Match.objects.select_for_update()
                .only("id", "user_a_id", "user_b_id", "status")
                .filter(id=self.match_id)
                .first()
            )
            if match is None:
                raise ValueError("Match not found.")
            if user_id not in {match.user_a_id, match.user_b_id}:
                raise ValueError("You are not part of this match.")
            if match.status != Match.Status.MATCHED:
                raise ValueError("Game can start only for matched users.")

            category = (
                GameCategory.objects.only("id", "slug", "name", "is_active")
                .filter(slug=category_slug, is_active=True)
                .first()
            )
            if category is None:
                raise ValueError("Category not found.")

            user = User.objects.only("id").get(id=user_id)
            questions = get_random_questions(user=user, category=category.slug, limit=limit)
            if not questions:
                raise ValueError("No questions available for this category.")

            question_ids = [item["id"] for item in questions]
            question_rows = list(
                GameQuestion.objects.filter(id__in=question_ids)
                .values("id", "game_id")
            )
            if not question_rows:
                raise ValueError("Could not resolve selected questions.")

            game_id = question_rows[0]["game_id"]
            same_game_ids = {row["id"] for row in question_rows if row["game_id"] == game_id}
            ordered_questions = [q for q in questions if q["id"] in same_game_ids][:3]
            if not ordered_questions:
                raise ValueError("Could not build a valid game session.")

            session, _ = GameSession.objects.select_for_update().get_or_create(
                match_id=self.match_id,
                game_id=game_id,
                status=GameSession.Status.ACTIVE,
                defaults={
                    "category_id": category.id,
                    "created_by_id": user_id,
                    "started_by_id": user_id,
                    "current_question_index": 0,
                },
            )

            # Start fresh for this game start event.
            GameSessionQuestion.objects.filter(session_id=session.id).delete()
            GameResponse.objects.filter(session_id=session.id).delete()

            session.category_id = category.id
            session.created_by_id = user_id
            session.started_by_id = user_id
            session.current_question_index = 0
            session.status = GameSession.Status.ACTIVE
            session.save(
                update_fields=[
                    "category",
                    "created_by",
                    "started_by",
                    "current_question_index",
                    "status",
                ]
            )

            GameSessionQuestion.objects.bulk_create(
                [
                    GameSessionQuestion(
                        session_id=session.id,
                        question_id=item["id"],
                        order=index,
                    )
                    for index, item in enumerate(ordered_questions, start=1)
                ]
            )

            message_payload = {
                "event_type": "game_started",
                "match_id": self.match_id,
                "session_id": session.id,
                "category": category.slug,
                "game_name": category.name,
                "questions": ordered_questions,
            }
            message = Message.objects.create(
                match_id=self.match_id,
                sender_id=user_id,
                content=f"Started a game: {category.slug}",
                message_type=Message.MessageType.GAME_EVENT,
                game_payload=message_payload,
                status=Message.Status.DELIVERED,
                is_read=False,
            )

            recipient_user_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
            notify_new_message(recipient_user_id=recipient_user_id)

        return {
            "session_id": session.id,
            "category": category.slug,
            "game_name": category.name,
            "questions": ordered_questions,
            "message": MessageSerializer(message).data,
        }

    @database_sync_to_async
    def _handle_answer_question(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
            question_id = int(data.get("question_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id and question_id are required.")

        selected_option_id = data.get("selected_option_id")
        selected_option_text = data.get("selected_option")
        explicit_text_answer = data.get("text_answer")

        if selected_option_id is not None:
            try:
                selected_option_id = int(selected_option_id)
            except (TypeError, ValueError):
                raise ValueError("selected_option_id must be an integer.")

        with transaction.atomic():
            session = (
                GameSession.objects.select_for_update()
                .only(
                    "id",
                    "match_id",
                    "status",
                    "category_id",
                )
                .filter(id=session_id, match_id=self.match_id)
                .first()
            )
            if session is None:
                raise ValueError("Game session not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("Game session is not active.")

            match = (
                Match.objects.only("id", "user_a_id", "user_b_id")
                .filter(id=session.match_id)
                .first()
            )
            if match is None:
                raise ValueError("Match not found for this game session.")

            participant_ids = {match.user_a_id, match.user_b_id}
            if user_id not in participant_ids:
                raise ValueError("You are not part of this game session.")

            if not GameSessionQuestion.objects.filter(
                session_id=session.id,
                question_id=question_id,
            ).exists():
                raise ValueError("Question does not belong to this session.")

            selected_option = None
            text_answer = ""
            if selected_option_id is not None:
                selected_option = (
                    GameOption.objects.only("id")
                    .filter(id=selected_option_id, question_id=question_id)
                    .first()
                )
                if selected_option is None:
                    raise ValueError("selected_option_id is invalid for this question.")
            else:
                if explicit_text_answer is not None:
                    text_answer = str(explicit_text_answer).strip()
                elif selected_option_text is not None:
                    text_answer = str(selected_option_text).strip()
                if not text_answer:
                    raise ValueError("selected_option or text_answer is required.")

            GameResponse.objects.update_or_create(
                session_id=session.id,
                user_id=user_id,
                question_id=question_id,
                defaults={
                    "selected_option_id": selected_option.id if selected_option else None,
                    "text_answer": text_answer,
                },
            )

            question_ids = list(
                GameSessionQuestion.objects.filter(session_id=session.id)
                .order_by("order", "id")
                .values_list("question_id", flat=True)
            )
            required_pairs = len(question_ids) * len(participant_ids)
            answered_pairs = (
                GameResponse.objects.filter(
                    session_id=session.id,
                    question_id__in=question_ids,
                    user_id__in=participant_ids,
                )
                .values("question_id", "user_id")
                .distinct()
                .count()
            )

            is_completed = bool(required_pairs and answered_pairs >= required_pairs)
            if is_completed:
                session.status = GameSession.Status.COMPLETED
                session.save(update_fields=["status"])

                result = calculate_game_result(session.id)
                category_slug = ""
                if session.category_id:
                    category_slug = (
                        GameCategory.objects.filter(id=session.category_id)
                        .values_list("slug", flat=True)
                        .first()
                        or ""
                    )
                game_result_payload = {
                    "event_type": "game_result",
                    "match_id": self.match_id,
                    "session_id": session.id,
                    "category": category_slug,
                    "result": result,
                }
                result_message = Message.objects.create(
                    match_id=self.match_id,
                    sender_id=user_id,
                    content=result.get("summary", "Game completed."),
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload=game_result_payload,
                    status=Message.Status.DELIVERED,
                    is_read=False,
                )

                return {
                    "event": "game_result",
                    "data": {
                        "session_id": session.id,
                        "category": category_slug,
                        "completed": True,
                        "result": result,
                        "message": MessageSerializer(result_message).data,
                    },
                }

            return {
                "event": "game_update",
                "data": {
                    "session_id": session.id,
                    "question_id": question_id,
                    "answered_pairs": answered_pairs,
                    "required_pairs": required_pairs,
                    "completed": False,
                },
            }
