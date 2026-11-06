from typing import Any
from datetime import timedelta
import math
import re
import random
import string

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone

from apps.games.models import (
    GameCategory,
    GameOption,
    GameQuestion,
    GameResponse,
    GameSession,
    GameSessionQuestion,
    QuestionExposure,
)
from apps.games.services import calculate_game_result, generate_question_result
from apps.games.snakes_ladders import apply_action as apply_snakes_ladders_action, create_initial_state as create_snakes_ladders_state, serialize_state as serialize_snakes_ladders_state
from apps.games.bingo import apply_action as apply_bingo_action, create_initial_state as create_bingo_state, serialize_state as serialize_bingo_state
from apps.games.spot_the_difference import apply_action as apply_spot_difference_action, create_initial_state as create_spot_difference_state, serialize_state as serialize_spot_difference_state
from apps.games.memory_match import apply_action as apply_memory_match_action, create_initial_state as create_memory_match_state, serialize_state as serialize_memory_match_state
from apps.matching.models import Match, ModerationAction, UserBlock
from apps.notifications.services import notify_game_turn, notify_new_message
from apps.services.game_service import get_random_adventure_questions, get_random_questions

from .models import Message
from .serializers import MessageSerializer

User = get_user_model()


def _make_word_search(words: list[str], size: int = 12) -> tuple[list[list[str]], dict[str, list[list[int]]]]:
    grid = [[""] * size for _ in range(size)]
    directions = [(0, 1), (1, 0), (1, 1), (0, -1), (-1, 0), (-1, -1), (1, -1), (-1, 1)]
    paths: dict[str, list[list[int]]] = {}
    for word in words:
        placed = False
        for _ in range(600):
            dr, dc = random.choice(directions)
            row, col = random.randrange(size), random.randrange(size)
            end_row, end_col = row + dr * (len(word) - 1), col + dc * (len(word) - 1)
            if not (0 <= end_row < size and 0 <= end_col < size):
                continue
            coords = [[row + dr * offset, col + dc * offset] for offset in range(len(word))]
            if all(not grid[r][c] or grid[r][c] == letter for (r, c), letter in zip(coords, word)):
                for (r, c), letter in zip(coords, word):
                    grid[r][c] = letter
                paths[word] = coords
                placed = True
                break
        if not placed:
            raise ValueError("Could not build a Word Search puzzle. Please try again.")
    for row in range(size):
        for col in range(size):
            if not grid[row][col]:
                grid[row][col] = random.choice(string.ascii_uppercase)
    return grid, paths


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
        for invite_message in await self._expire_old_game_invites(user.id):
            await self.send_json({
                "event": "game_invite_updated",
                "data": {
                    "session_id": invite_message.game_payload.get("session_id"),
                    "invite_status": "expired",
                    "message": MessageSerializer(invite_message).data,
                },
            })
        waiting_game = await self._get_waiting_game_state(user.id)
        if waiting_game:
            await self.send_json({"event": "game_update", "data": waiting_game})

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
        # Re-check authorization for every event so an already-open socket loses
        # access immediately after a block, unmatch, or account-status change.
        if not await self._user_can_access_match(self.match_id, user.id):
            await self.close(code=4403)
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
                for closed_invite in payload.pop("closed_invites", []):
                    await self._broadcast("game_invite_updated", closed_invite)
                await self._broadcast("game_invite", payload)
                return

            if event_name == "respond_game_invite":
                result = await self._handle_game_invite_response(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "tic_tac_toe_move":
                result = await self._handle_tic_tac_toe_move(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "dots_boxes_move":
                result = await self._handle_dots_boxes_move(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name in {"tic_tac_toe_state_request", "dots_boxes_state_request"}:
                state = await self._get_board_game_state(user.id, data, event_name)
                await self.send_json({"event": "tic_tac_toe_state" if event_name == "tic_tac_toe_state_request" else "dots_boxes_state", "data": state})
                return

            if event_name == "snakes_ladders_state_request":
                state = await self._get_snakes_ladders_state(user.id, data)
                await self.send_json({"event": "snakes_ladders_state", "data": state})
                return

            if event_name == "snakes_ladders_action":
                result = await self._handle_snakes_ladders_action(user.id, data)
                await self._broadcast(result["event"], result["data"])
                await self.send_json({"event": "snakes_ladders_state", "data": result["personalized_state"]})
                if result.get("completed"):
                    await self._broadcast("game_session_completed", result["completed"])
                return

            if event_name == "bingo_state_request":
                state = await self._get_bingo_state(user.id, data)
                await self.send_json({"event": "bingo_state", "data": state})
                return

            if event_name == "bingo_action":
                result = await self._handle_bingo_action(user.id, data)
                await self._broadcast(result["event"], result["data"])
                await self.send_json({"event": "bingo_state", "data": result["personalized_state"]})
                if result.get("completed"):
                    await self._broadcast("game_session_completed", result["completed"])
                return

            if event_name in {"spot_difference_state_request", "memory_match_state_request"}:
                category = "spot_the_difference" if event_name.startswith("spot_difference") else "memory_match"
                state = await self._get_spot_memory_state(user.id, data, category)
                await self.send_json({"event": "spot_difference_state" if category == "spot_the_difference" else "memory_match_state", "data": state})
                return

            if event_name in {"spot_difference_action", "memory_match_action"}:
                category = "spot_the_difference" if event_name.startswith("spot_difference") else "memory_match"
                result = await self._handle_spot_memory_action(user.id, data, category)
                await self._broadcast(result["event"], result["data"])
                await self.send_json({"event": "spot_difference_state" if category == "spot_the_difference" else "memory_match_state", "data": result["personalized_state"]})
                if result.get("completed"):
                    await self._broadcast("game_session_completed", result["completed"])
                return

            if event_name == "pictionary_state_request":
                state = await self._get_pictionary_state(user.id, data)
                await self.send_json({"event": "pictionary_state", "data": state})
                return

            if event_name == "pictionary_submit_drawing":
                result = await self._handle_pictionary_drawing(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "pictionary_submit_guess":
                result = await self._handle_pictionary_guess(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "pictionary_give_up":
                result = await self._handle_pictionary_give_up(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "word_search_state_request":
                state = await self._get_word_search_state(user.id, data)
                await self.send_json({"event": "word_search_state", "data": state})
                return

            if event_name == "word_search_select":
                result = await self._handle_word_search_select(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "unscramble_state_request":
                state = await self._get_unscramble_state(user.id, data)
                await self.send_json({"event": "unscramble_state", "data": state})
                return

            if event_name == "unscramble_submit":
                result = await self._handle_unscramble_submit(user.id, data)
                await self._broadcast(result["event"], result["data"])
                await self.send_json({"event": "unscramble_feedback", "data": result["feedback"]})
                return

            if event_name == "word_association_state_request":
                state = await self._get_word_association_state(user.id, data)
                await self.send_json({"event": "word_association_state", "data": state})
                return

            if event_name == "word_association_submit":
                result = await self._handle_word_association_submit(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "collaborative_playlist_state_request":
                state = await self._get_collaborative_playlist_state(user.id, data)
                await self.send_json({"event": "collaborative_playlist_state", "data": state})
                return

            if event_name == "collaborative_playlist_submit":
                result = await self._handle_collaborative_playlist_submit(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "mystery_playlist_mood_state_request":
                state = await self._get_mystery_playlist_mood_state(user.id, data)
                await self.send_json({"event": "mystery_playlist_mood_state", "data": state})
                return

            if event_name == "mystery_playlist_mood_submit":
                result = await self._handle_mystery_playlist_mood_submit(user.id, data)
                await self._broadcast(result["event"], result["data"])
                return

            if event_name == "answer_question":
                result = await self._handle_answer_question(user.id, data)
                await self._broadcast(result["event"], result["data"])
                if result.get("followup"):
                    await self._broadcast(result["followup"]["event"], result["followup"]["data"])
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

    async def safety_close(self, event):
        await self.send_json({"event": "safety_connection_closed", "data": {"detail": "This conversation is no longer available."}})
        await self.close(code=4403)

    @database_sync_to_async
    def _user_can_access_match(self, match_id: int, user_id: int) -> bool:
        match = Match.objects.filter(id=match_id, status=Match.Status.MATCHED, is_visible=True).filter(
            models.Q(user_a_id=user_id) | models.Q(user_b_id=user_id)
        ).first()
        if match is None:
            return False
        if UserBlock.objects.filter(
            models.Q(blocker_id=match.user_a_id, blocked_user_id=match.user_b_id)
            | models.Q(blocker_id=match.user_b_id, blocked_user_id=match.user_a_id)
        ).exists():
            return False
        return not ModerationAction.objects.filter(
            subject_id=user_id,
            action_type=ModerationAction.ActionType.RESTRICTION,
            reversed_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).filter(models.Q(scope="") | models.Q(scope="all") | models.Q(scope="messaging")).exists()

    @database_sync_to_async
    def _expire_old_game_invites(self, user_id: int) -> list[Message]:
        cutoff = timezone.now() - timedelta(days=7)
        expired_sessions = list(
            GameSession.objects.filter(
                match_id=self.match_id,
                status=GameSession.Status.INVITED,
                created_at__lt=cutoff,
            ).filter(models.Q(match__user_a_id=user_id) | models.Q(match__user_b_id=user_id))
        )
        messages = []
        for session in expired_sessions:
            session.status = GameSession.Status.EXPIRED
            session.save(update_fields=["status"])
            invite_message = Message.objects.filter(
                match_id=self.match_id,
                game_payload__session_id=session.id,
                game_payload__event_type="game_invite",
            ).order_by("-created_at", "-id").first()
            if invite_message:
                invite_message.content = "Game invite expired"
                invite_message.game_payload = {**invite_message.game_payload, "invite_status": "expired"}
                invite_message.save(update_fields=["content", "game_payload"])
                messages.append(invite_message)
        return messages

    @database_sync_to_async
    def _get_waiting_game_state(self, user_id: int) -> dict[str, Any] | None:
        session = (
            GameSession.objects.filter(match_id=self.match_id, status=GameSession.Status.ACTIVE)
            .order_by("-created_at", "-id")
            .first()
        )
        if session is None:
            return None

        if session.category_id and session.category.slug == "snakes_ladders":
            game_state = session.game_state or {}
            turn_user_id = game_state.get("turn_user_id")
            return {
                "session_id": session.id,
                "category": "snakes_ladders",
                "game_name": session.category.name,
                "snakes_ladders_state": serialize_snakes_ladders_state(game_state, user_id),
                "your_turn": int(turn_user_id or 0) == int(user_id),
                "waiting_for_match": int(turn_user_id or 0) != int(user_id),
                "state_sync": True,
            }

        if session.category_id and session.category.slug == "bingo":
            game_state = session.game_state or {}
            turn_user_id = game_state.get("turn_user_id")
            return {
                "session_id": session.id,
                "category": "bingo",
                "game_name": session.category.name,
                "bingo_state": serialize_bingo_state(game_state, user_id),
                "your_turn": int(turn_user_id or 0) == int(user_id),
                "waiting_for_match": int(turn_user_id or 0) != int(user_id),
                "state_sync": True,
            }

        if session.category_id and session.category.slug in {"spot_the_difference", "memory_match"}:
            game_state = session.game_state or {}
            turn_user_id = game_state.get("turn_user_id")
            is_spot = session.category.slug == "spot_the_difference"
            serializer = serialize_spot_difference_state if is_spot else serialize_memory_match_state
            field = "spot_difference_state" if is_spot else "memory_match_state"
            return {
                "session_id": session.id,
                "category": session.category.slug,
                "game_name": session.category.name,
                field: serializer(game_state),
                "your_turn": int(turn_user_id or 0) == int(user_id),
                "waiting_for_match": int(turn_user_id or 0) != int(user_id),
                "state_sync": True,
            }

        question_ids = list(
            GameSessionQuestion.objects.filter(session_id=session.id)
            .order_by("order", "id")
            .values_list("question_id", flat=True)
        )
        if not question_ids:
            return None
        own_answered_ids = set(
            GameResponse.objects.filter(session_id=session.id, user_id=user_id)
            .values_list("question_id", flat=True)
        )
        match = Match.objects.only("user_a_id", "user_b_id").get(id=self.match_id)
        partner_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
        partner_answer_count = GameResponse.objects.filter(
            session_id=session.id, user_id=partner_id
        ).count()
        statement_sets = None
        guessed_question_ids = []
        if session.category_id and session.category.slug == "guess_their_pick":
            own_answered_ids = set(
                GameResponse.objects.filter(
                    session_id=session.id, user_id=user_id, predicted_text_answer__gt=""
                ).values_list("question_id", flat=True)
            )
            partner_answer_count = GameResponse.objects.filter(
                session_id=session.id, user_id=partner_id, predicted_text_answer__gt=""
            ).count()
        elif session.category_id and session.category.slug in {"build_a_story", "caption_this"}:
            own_answered_ids = set(
                GameResponse.objects.filter(
                    session_id=session.id, user_id=user_id, story_text__gt=""
                ).values_list("question_id", flat=True)
            )
            partner_answer_count = GameResponse.objects.filter(
                session_id=session.id, user_id=partner_id, story_text__gt=""
            ).count()
        elif session.category_id and session.category.slug == "photo_scavenger_hunt":
            own_answered_ids = set(GameResponse.objects.filter(
                session_id=session.id, user_id=user_id, text_answer="__photo_scavenger_submission__",
            ).values_list("question_id", flat=True))
            partner_answer_count = GameResponse.objects.filter(
                session_id=session.id, user_id=partner_id, text_answer="__photo_scavenger_submission__",
            ).count()
        elif session.category_id and session.category.slug == "secret_song_pick":
            own_answered_ids = set(GameResponse.objects.filter(
                session_id=session.id, user_id=user_id, text_answer__gt="",
            ).values_list("question_id", flat=True))
            partner_answer_count = GameResponse.objects.filter(
                session_id=session.id, user_id=partner_id, text_answer__gt="",
            ).count()
        elif session.category_id and session.category.slug == "two_truths_and_a_lie":
            response_rows = list(GameResponse.objects.filter(
                session_id=session.id, question_id__in=question_ids,
                user_id__in=[user_id, partner_id],
            ).values("user_id", "question_id", "truth_statements", "guessed_lie_index"))
            by_user = {row["user_id"]: row for row in response_rows}
            own_row = by_user.get(user_id)
            partner_row = by_user.get(partner_id)
            own_submitted = bool(own_row and len(own_row["truth_statements"] or []) == 3)
            partner_submitted = bool(partner_row and len(partner_row["truth_statements"] or []) == 3)
            own_answered_ids = {own_row["question_id"]} if own_submitted else set()
            partner_answer_count = 1 if partner_submitted else 0
            guessed_question_ids = [own_row["question_id"]] if own_row and own_row["guessed_lie_index"] is not None else []
            if own_submitted and partner_submitted:
                statement_sets = {
                    str(user_id): own_row["truth_statements"],
                    str(partner_id): partner_row["truth_statements"],
                }
        own_complete = len(own_answered_ids) >= len(question_ids)
        partner_complete = partner_answer_count >= len(question_ids)
        waiting_for_match = own_complete and not partner_complete
        your_turn = partner_complete and not own_complete
        if session.category_id and session.category.slug == "two_truths_and_a_lie":
            own_guessed = len(guessed_question_ids) >= len(question_ids)
            partner_rows = GameResponse.objects.filter(
                session_id=session.id, user_id=partner_id, guessed_lie_index__isnull=False
            ).count()
            waiting_for_match = (own_complete and partner_complete and own_guessed and partner_rows < len(question_ids)) or (own_complete and not partner_complete)
            your_turn = own_complete and partner_complete and not own_guessed
        state_payload = {
            "session_id": session.id,
            "category": session.category.slug if session.category_id else "this_or_that",
            "game_name": session.category.name if session.category_id else session.game.name,
            "question_ids": question_ids,
            "answered_question_ids": [qid for qid in question_ids if qid in own_answered_ids],
            "answered_count": len(own_answered_ids),
            "match_answered_count": partner_answer_count,
            "waiting_for_match": waiting_for_match,
            "your_turn": your_turn,
            "statement_sets": statement_sets,
            "guessed_question_ids": guessed_question_ids,
            "state_sync": True,
        }
        if session.category_id and session.category.slug == "tic_tac_toe":
            tic_state = session.game_state or {}
            state_payload["tic_tac_toe_state"] = tic_state
            if not tic_state.get("winner_user_id") and not tic_state.get("draw"):
                state_payload["your_turn"] = int(tic_state.get("turn_user_id") or 0) == int(user_id)
                state_payload["waiting_for_match"] = not state_payload["your_turn"]
        if session.category_id and session.category.slug == "dots_and_boxes":
            dots_state = session.game_state or {}
            state_payload["dots_boxes_state"] = dots_state
            if not dots_state.get("completed"):
                state_payload["your_turn"] = int(dots_state.get("turn_user_id") or 0) == int(user_id)
                state_payload["waiting_for_match"] = not state_payload["your_turn"]
        if session.category_id and session.category.slug == "snakes_ladders":
            snakes_state = session.game_state or {}
            state_payload["snakes_ladders_state"] = serialize_snakes_ladders_state(snakes_state, user_id)
            state_payload["your_turn"] = int(snakes_state.get("turn_user_id") or 0) == int(user_id)
            state_payload["waiting_for_match"] = not state_payload["your_turn"]
        if session.category_id and session.category.slug == "bingo":
            bingo_state = session.game_state or {}
            state_payload["bingo_state"] = serialize_bingo_state(bingo_state, user_id)
            state_payload["your_turn"] = int(bingo_state.get("turn_user_id") or 0) == int(user_id)
            state_payload["waiting_for_match"] = not state_payload["your_turn"]
        if session.category_id and session.category.slug == "pictionary":
            state_payload["pictionary_state"] = self._serialize_pictionary_state(session, user_id)
        if session.category_id and session.category.slug == "word_search":
            state_payload["word_search_state"] = self._serialize_word_search_state(session, user_id)
        if session.category_id and session.category.slug == "unscramble":
            state_payload["unscramble_state"] = self._serialize_unscramble_state(session, user_id)
        if session.category_id and session.category.slug == "word_association":
            state_payload["word_association_state"] = session.game_state or {}
        if session.category_id and session.category.slug == "collaborative_playlist":
            state_payload["collaborative_playlist_state"] = session.game_state or {}
        if session.category_id and session.category.slug == "mystery_playlist_mood":
            state_payload["mystery_playlist_mood_state"] = self._serialize_mystery_playlist_mood_state(
                session.game_state or {}, user_id,
            )
        return state_payload

    @database_sync_to_async
    def _get_word_association_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="word_association",
            status__in=[GameSession.Status.ACTIVE, GameSession.Status.COMPLETED],
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Word Association game not found.")
        return {"session_id": session.id, "state": session.game_state or {}, "state_sync": True}

    @database_sync_to_async
    def _handle_word_association_submit(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        word = str(data.get("word", "")).strip()
        if not re.fullmatch(r"[\w'-]{1,30}", word, flags=re.UNICODE):
            raise ValueError("Enter one word using up to 30 letters.")

        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related(
                "match", "category",
            ).filter(
                id=session_id, match_id=self.match_id, category__slug="word_association",
            ).first()
            if session is None or session.status != GameSession.Status.ACTIVE:
                raise ValueError("Word Association game is not active.")
            match = session.match
            if user_id not in {match.user_a_id, match.user_b_id}:
                raise ValueError("You are not part of this game.")
            state = session.game_state or {}
            if int(state.get("turn_user_id") or 0) != int(user_id):
                raise ValueError("It is your match's turn to add a word.")
            if state.get("completed"):
                raise ValueError("This word chain is already complete.")

            chain = list(state.get("chain") or [])
            if not chain:
                raise ValueError("The starter word is missing.")
            chain.append({"word": word, "user_id": user_id})
            turns_played = int(state.get("turns_played", 0)) + 1
            target_turns = int(state.get("target_turns", 6))
            partner_id = match.user_b_id if user_id == match.user_a_id else match.user_a_id
            completed = turns_played >= target_turns
            state.update({
                "chain": chain,
                "turns_played": turns_played,
                "completed": completed,
                "turn_user_id": None if completed else partner_id,
                "last_user_id": user_id,
            })
            session.game_state = state
            if completed:
                session.status = GameSession.Status.COMPLETED
            session.save(update_fields=["game_state", "status"] if completed else ["game_state"])

            if completed:
                start_word = str(chain[0].get("word", ""))
                end_word = str(chain[-1].get("word", ""))
                summary = f"Your word chain went from {start_word} to {end_word} 💭"
                result = {
                    "round_count": turns_played,
                    "summary": summary,
                    "questions": [{"question": start_word, "chain": chain}],
                }
                result_message = Message.objects.create(
                    match_id=self.match_id,
                    sender_id=user_id,
                    content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={
                        "event_type": "game_result", "match_id": self.match_id,
                        "session_id": session.id, "category": "word_association", "result": result,
                    },
                    status=Message.Status.DELIVERED,
                    is_read=False,
                )
                return {"event": "game_result", "data": {
                    "session_id": session.id,
                    "category": "word_association",
                    "result": result,
                    "word_association_state": state,
                    "message": MessageSerializer(result_message).data,
                    "completed": True,
                }}

            start_message = Message.objects.filter(
                match_id=self.match_id,
                game_payload__session_id=session.id,
                game_payload__event_type="game_started",
            ).order_by("-created_at", "-id").first()
            if start_message:
                start_message.game_payload = {
                    **start_message.game_payload,
                    "word_association_state": state,
                }
                start_message.save(update_fields=["game_payload"])
            notify_game_turn(recipient_user_id=partner_id, game_name="Word Association", match_id=self.match_id)
            return {"event": "word_association_update", "data": {
                "session_id": session.id,
                "state": state,
                "user_id": user_id,
                "your_turn_user_id": partner_id,
                "completed": False,
            }}

    @database_sync_to_async
    def _get_collaborative_playlist_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="collaborative_playlist",
            status=GameSession.Status.ACTIVE,
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Collaborative Playlist game not found.")
        return {"session_id": session.id, "state": session.game_state or {}, "state_sync": True}

    @database_sync_to_async
    def _handle_collaborative_playlist_submit(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        title = str(data.get("title", "")).strip()
        artist = str(data.get("artist", "")).strip()
        note = str(data.get("note", "")).strip()
        if not title or len(title) > 120:
            raise ValueError("Enter a song title up to 120 characters.")
        if not artist or len(artist) > 100:
            raise ValueError("Enter an artist up to 100 characters.")
        if len(note) > 140:
            raise ValueError("Keep your note under 140 characters.")

        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related(
                "match", "category",
            ).filter(
                id=session_id, match_id=self.match_id, category__slug="collaborative_playlist",
            ).first()
            if session is None or session.status != GameSession.Status.ACTIVE:
                raise ValueError("Collaborative Playlist is no longer active.")
            match = session.match
            if user_id not in {match.user_a_id, match.user_b_id}:
                raise ValueError("You are not part of this playlist.")
            state = session.game_state or {}
            if state.get("completed"):
                raise ValueError("This playlist is already complete.")
            if int(state.get("turn_user_id") or 0) != int(user_id):
                raise ValueError("It is your match's turn to add a song.")

            tracks = list(state.get("tracks") or [])
            tracks.append({"title": title, "artist": artist, "note": note, "user_id": user_id})
            turns_played = int(state.get("turns_played", 0)) + 1
            target_turns = int(state.get("target_turns", 6))
            partner_id = match.user_b_id if user_id == match.user_a_id else match.user_a_id
            completed = turns_played >= target_turns
            state.update({
                "tracks": tracks,
                "turns_played": turns_played,
                "completed": completed,
                "turn_user_id": None if completed else partner_id,
                "last_user_id": user_id,
            })
            session.game_state = state
            if completed:
                session.status = GameSession.Status.COMPLETED
            session.save(update_fields=["game_state", "status"] if completed else ["game_state"])

            if completed:
                theme = str(state.get("theme", "your shared playlist"))
                summary = f"You built a {len(tracks)}-song playlist together 🎧"
                result = {
                    "round_count": len(tracks),
                    "summary": summary,
                    "theme": theme,
                    "tracks": tracks,
                    "questions": [{"question": theme, "tracks": tracks}],
                }
                result_message = Message.objects.create(
                    match_id=self.match_id,
                    sender_id=user_id,
                    content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={
                        "event_type": "game_result", "match_id": self.match_id,
                        "session_id": session.id, "category": "collaborative_playlist", "result": result,
                    },
                    status=Message.Status.DELIVERED,
                    is_read=False,
                )
                return {"event": "game_result", "data": {
                    "session_id": session.id, "category": "collaborative_playlist", "result": result,
                    "message": MessageSerializer(result_message).data, "completed": True,
                }}

            start_message = Message.objects.filter(
                match_id=self.match_id,
                game_payload__session_id=session.id,
                game_payload__event_type="game_started",
            ).order_by("-created_at", "-id").first()
            if start_message:
                start_message.game_payload = {
                    **start_message.game_payload,
                    "collaborative_playlist_state": state,
                }
                start_message.save(update_fields=["game_payload"])
            notify_game_turn(
                recipient_user_id=partner_id, game_name="Collaborative Playlist", match_id=self.match_id,
            )
            return {"event": "collaborative_playlist_update", "data": {
                "session_id": session.id, "state": state, "user_id": user_id,
                "your_turn_user_id": partner_id, "completed": False,
            }}

    @staticmethod
    def _serialize_mystery_playlist_mood_state(state: dict[str, Any], user_id: int) -> dict[str, Any]:
        if state.get("phase") == "mood_pick":
            own_mood = (state.get("mood_picks") or {}).get(str(user_id))
            return {
                "phase": "mood_pick",
                "theme_prompt": state.get("theme_prompt", "Choose a playlist mood"),
                "mood_options": state.get("mood_options", []),
                "mood_picks_count": int(state.get("mood_picks_count", 0)),
                "own_mood": own_mood,
                "own_mood_submitted": bool(own_mood),
                "tracks": [],
                "turns_played": 0,
                "target_turns": int(state.get("target_turns", 6)),
                "completed": False,
            }
        return state

    @database_sync_to_async
    def _get_mystery_playlist_mood_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="mystery_playlist_mood",
            status=GameSession.Status.ACTIVE,
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Mystery Playlist Mood game not found.")
        return {
            "session_id": session.id,
            "state": self._serialize_mystery_playlist_mood_state(session.game_state or {}, user_id),
            "state_sync": True,
        }

    @database_sync_to_async
    def _handle_mystery_playlist_mood_submit(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        action = str(data.get("action", "")).strip().lower()

        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related(
                "match", "category",
            ).filter(
                id=session_id, match_id=self.match_id, category__slug="mystery_playlist_mood",
            ).first()
            if session is None or session.status != GameSession.Status.ACTIVE:
                raise ValueError("Mystery Playlist Mood is no longer active.")
            match = session.match
            if user_id not in {match.user_a_id, match.user_b_id}:
                raise ValueError("You are not part of this playlist game.")
            state = session.game_state or {}
            if state.get("completed"):
                raise ValueError("This playlist is already complete.")

            if state.get("phase") == "mood_pick":
                if action != "mood_pick":
                    raise ValueError("Choose a mood before adding songs.")
                mood = str(data.get("mood", "")).strip()
                if mood not in (state.get("mood_options") or []):
                    raise ValueError("Choose a mood from the list.")
                picks = dict(state.get("mood_picks") or {})
                if str(user_id) in picks:
                    raise ValueError("Your mood is already locked in.")
                picks[str(user_id)] = mood
                state["mood_picks"] = picks
                state["mood_picks_count"] = len(picks)
                state["last_user_id"] = user_id
                partner_id = match.user_b_id if user_id == match.user_a_id else match.user_a_id
                if len(picks) == 2:
                    state["phase"] = "songs"
                    state["turn_user_id"] = int(state.get("started_by_id") or user_id)
                    state["moods_revealed"] = True
                    # Notify the first person to add a song if they were not the mood chooser just now.
                    if int(state["turn_user_id"]) != int(user_id):
                        notify_game_turn(
                            recipient_user_id=state["turn_user_id"],
                            game_name="Mystery Playlist Mood",
                            match_id=self.match_id,
                        )
                session.game_state = state
                session.save(update_fields=["game_state"])

                if state["phase"] == "mood_pick":
                    safe_state = {
                        "phase": "mood_pick",
                        "theme_prompt": state.get("theme_prompt"),
                        "mood_options": state.get("mood_options", []),
                        "mood_picks_count": len(picks),
                        "last_user_id": user_id,
                        "tracks": [],
                        "turns_played": 0,
                        "target_turns": int(state.get("target_turns", 6)),
                        "completed": False,
                    }
                    if len(picks) == 1:
                        notify_game_turn(
                            recipient_user_id=partner_id,
                            game_name="Mystery Playlist Mood",
                            match_id=self.match_id,
                        )
                    return {"event": "mystery_playlist_mood_update", "data": {
                        "session_id": session.id, "state": safe_state,
                        "user_id": user_id, "completed": False,
                    }}

                start_message = Message.objects.filter(
                    match_id=self.match_id,
                    game_payload__session_id=session.id,
                    game_payload__event_type="game_started",
                ).order_by("-created_at", "-id").first()
                if start_message:
                    start_message.game_payload = {
                        **start_message.game_payload,
                        "mystery_playlist_mood_state": state,
                    }
                    start_message.save(update_fields=["game_payload"])
                return {"event": "mystery_playlist_mood_update", "data": {
                    "session_id": session.id, "state": state,
                    "user_id": user_id, "completed": False,
                }}

            if state.get("phase") != "songs" or action != "add_song":
                raise ValueError("Choose a mood before adding songs.")
            if int(state.get("turn_user_id") or 0) != int(user_id):
                raise ValueError("It is your match's turn to add a song.")
            title = str(data.get("title", "")).strip()
            artist = str(data.get("artist", "")).strip()
            note = str(data.get("note", "")).strip()
            if not title or len(title) > 120:
                raise ValueError("Enter a song title up to 120 characters.")
            if not artist or len(artist) > 100:
                raise ValueError("Enter an artist up to 100 characters.")
            if len(note) > 140:
                raise ValueError("Keep your note under 140 characters.")
            tracks = list(state.get("tracks") or [])
            tracks.append({"title": title, "artist": artist, "note": note, "user_id": user_id})
            turns_played = int(state.get("turns_played", 0)) + 1
            target_turns = int(state.get("target_turns", 6))
            partner_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
            completed = turns_played >= target_turns
            state.update({
                "tracks": tracks,
                "turns_played": turns_played,
                "completed": completed,
                "turn_user_id": None if completed else partner_id,
                "last_user_id": user_id,
            })
            session.game_state = state
            if completed:
                session.status = GameSession.Status.COMPLETED
            session.save(update_fields=["game_state", "status"] if completed else ["game_state"])

            if completed:
                mood_a = state["mood_picks"].get(str(match.user_a_id), "")
                mood_b = state["mood_picks"].get(str(match.user_b_id), "")
                summary = "Your mystery mood playlist is ready 🎶"
                result = {
                    "round_count": len(tracks),
                    "summary": summary,
                    "mood_a": mood_a,
                    "mood_b": mood_b,
                    "mood_matched": mood_a.casefold() == mood_b.casefold(),
                    "tracks": tracks,
                    "questions": [{"question": f"{mood_a} + {mood_b}", "tracks": tracks}],
                }
                result_message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={
                        "event_type": "game_result", "match_id": self.match_id,
                        "session_id": session.id, "category": "mystery_playlist_mood", "result": result,
                    },
                    status=Message.Status.DELIVERED, is_read=False,
                )
                return {"event": "game_result", "data": {
                    "session_id": session.id, "category": "mystery_playlist_mood",
                    "result": result, "message": MessageSerializer(result_message).data,
                    "completed": True,
                }}

            start_message = Message.objects.filter(
                match_id=self.match_id,
                game_payload__session_id=session.id,
                game_payload__event_type="game_started",
            ).order_by("-created_at", "-id").first()
            if start_message:
                start_message.game_payload = {
                    **start_message.game_payload,
                    "mystery_playlist_mood_state": state,
                }
                start_message.save(update_fields=["game_payload"])
            notify_game_turn(recipient_user_id=partner_id, game_name="Mystery Playlist Mood", match_id=self.match_id)
            return {"event": "mystery_playlist_mood_update", "data": {
                "session_id": session.id, "state": state, "user_id": user_id,
                "completed": False,
            }}

    @staticmethod
    def _serialize_pictionary_state(session, user_id: int) -> dict[str, Any]:
        state = session.game_state or {}
        rounds = state.get("rounds") or []
        index = int(state.get("round_index", 0) or 0)
        round_data = rounds[index] if index < len(rounds) else {}
        phase = state.get("phase", "drawing")
        is_drawer = phase in {"drawing", "guessing"} and int(round_data.get("drawer_id") or 0) == int(user_id)
        serialized_rounds = []
        for item in rounds[:index]:
            serialized_rounds.append({
                "drawer_id": item.get("drawer_id"), "guesser_id": item.get("guesser_id"),
                "prompt": item.get("prompt"), "strokes": item.get("strokes", []),
                "guess": item.get("guess"), "solved": bool(item.get("solved")),
            })
        current = {
            "drawer_id": round_data.get("drawer_id"),
            "guesser_id": round_data.get("guesser_id"),
            "strokes": round_data.get("strokes", []),
        } if phase in {"guessing", "drawing"} else None
        if phase == "completed":
            serialized_rounds = [{
                "drawer_id": item.get("drawer_id"), "guesser_id": item.get("guesser_id"),
                "prompt": item.get("prompt"), "strokes": item.get("strokes", []),
                "guess": item.get("guess"), "solved": bool(item.get("solved")),
            } for item in rounds]
            current = None
        return {
            "session_id": session.id, "phase": phase, "round_index": index,
            "round_count": len(rounds), "is_drawer": is_drawer,
            "prompt": round_data.get("prompt") if is_drawer else None,
            "current": current, "rounds": serialized_rounds,
            "scores": state.get("scores", {}), "your_user_id": int(user_id),
        }

    @database_sync_to_async
    def _get_pictionary_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="pictionary",
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Pictionary game not found.")
        return self._serialize_pictionary_state(session, user_id)

    @database_sync_to_async
    def _handle_pictionary_drawing(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        session = self._lock_pictionary_session(user_id, data)
        state = session.game_state or {}
        if session.status != GameSession.Status.ACTIVE or state.get("phase") != "drawing":
            raise ValueError("This drawing round is not open.")
        index = int(state.get("round_index", 0) or 0)
        rounds = state.get("rounds") or []
        if index >= len(rounds) or int(rounds[index].get("drawer_id") or 0) != user_id:
            raise ValueError("It is your match's turn to draw.")
        strokes = data.get("strokes")
        if not isinstance(strokes, list) or not strokes or len(strokes) > 100:
            raise ValueError("Add a drawing before submitting (up to 100 strokes).")
        clean_strokes = []
        point_count = 0
        for stroke in strokes:
            points = stroke.get("points") if isinstance(stroke, dict) else None
            if not isinstance(points, list) or not points:
                continue
            clean_points = []
            for point in points:
                if not isinstance(point, (list, tuple)) or len(point) != 2:
                    continue
                try:
                    x, y = float(point[0]), float(point[1])
                except (TypeError, ValueError):
                    continue
                if not math.isfinite(x) or not math.isfinite(y):
                    continue
                clean_points.append([round(max(0, min(1, x)), 4), round(max(0, min(1, y)), 4)])
                point_count += 1
                if point_count > 2500:
                    raise ValueError("That drawing has too many points.")
            if clean_points:
                clean_strokes.append({"points": clean_points})
        if not clean_strokes:
            raise ValueError("Add a drawing before submitting.")
        rounds[index]["strokes"] = clean_strokes
        state.update({"phase": "guessing", "rounds": rounds})
        session.game_state = state
        session.save(update_fields=["game_state"])
        notify_game_turn(recipient_user_id=rounds[index]["guesser_id"], game_name="Pictionary", match_id=self.match_id)
        return {"event": "pictionary_update", "data": {"session_id": session.id}}

    @database_sync_to_async
    def _handle_pictionary_guess(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        guess = str(data.get("guess", "")).strip()[:120]
        if not guess:
            raise ValueError("Enter your guess.")
        with transaction.atomic():
            session = self._lock_pictionary_session(user_id, data)
            state = session.game_state or {}
            index = int(state.get("round_index", 0) or 0)
            rounds = state.get("rounds") or []
            if session.status != GameSession.Status.ACTIVE or state.get("phase") != "guessing" or index >= len(rounds):
                raise ValueError("This round is not ready for a guess.")
            item = rounds[index]
            if int(item.get("guesser_id") or 0) != user_id:
                raise ValueError("Your match is guessing this drawing.")
            normalize = lambda value: re.sub(r"[^a-z0-9]+", "", str(value).casefold())
            if normalize(guess) != normalize(item.get("prompt", "")):
                raise ValueError("Not quite. Try another guess!")
            item["guess"] = guess
            item["solved"] = True
            scores = state.get("scores") or {}
            scores[str(user_id)] = int(scores.get(str(user_id), 0)) + 1
            state["scores"] = scores
            rounds[index] = item
            if index + 1 < len(rounds):
                state.update({"round_index": index + 1, "phase": "drawing", "rounds": rounds})
                session.game_state = state
                session.save(update_fields=["game_state"])
                notify_game_turn(recipient_user_id=rounds[index + 1]["drawer_id"], game_name="Pictionary", match_id=self.match_id)
                return {"event": "pictionary_update", "data": {"session_id": session.id}}
            return self._complete_pictionary(session, state, rounds)

    @database_sync_to_async
    def _handle_pictionary_give_up(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        with transaction.atomic():
            session = self._lock_pictionary_session(user_id, data)
            state = session.game_state or {}
            index = int(state.get("round_index", 0) or 0)
            rounds = state.get("rounds") or []
            if session.status != GameSession.Status.ACTIVE or state.get("phase") != "guessing" or index >= len(rounds):
                raise ValueError("There is no active guess to reveal.")
            if int(rounds[index].get("guesser_id") or 0) != user_id:
                raise ValueError("Only the guesser can reveal this prompt.")
            rounds[index]["solved"] = False
            rounds[index]["guess"] = "Gave up"
            if index + 1 < len(rounds):
                state.update({"round_index": index + 1, "phase": "drawing", "rounds": rounds})
                session.game_state = state
                session.save(update_fields=["game_state"])
                notify_game_turn(recipient_user_id=rounds[index + 1]["drawer_id"], game_name="Pictionary", match_id=self.match_id)
                return {"event": "pictionary_update", "data": {"session_id": session.id}}
            return self._complete_pictionary(session, state, rounds)

    def _complete_pictionary(self, session, state: dict[str, Any], rounds: list[dict[str, Any]]) -> dict[str, Any]:
        state.update({"phase": "completed", "round_index": len(rounds) - 1, "rounds": rounds})
        session.game_state = state
        session.status = GameSession.Status.COMPLETED
        session.save(update_fields=["game_state", "status"])
        result = {
            "questions": [], "rounds": self._serialize_pictionary_state(session, session.match.user_a_id)["rounds"],
            "scores": state.get("scores", {}), "round_count": len(rounds),
            "summary": "Both drawings revealed! Nice teamwork 🎨",
        }
        message = Message.objects.create(
            match_id=self.match_id, sender_id=session.started_by_id, content=result["summary"],
            message_type=Message.MessageType.GAME_EVENT,
            game_payload={"event_type": "game_result", "match_id": self.match_id,
                          "session_id": session.id, "category": "pictionary", "result": result},
            status=Message.Status.DELIVERED, is_read=False,
        )
        return {"event": "game_session_completed", "data": {
            "session_id": session.id, "completed": True, "pictionary_state": result,
            "messages": [MessageSerializer(message).data],
        }}

    def _lock_pictionary_session(self, user_id: int, data: dict[str, Any]):
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        queryset = GameSession.objects.select_related("match", "category")
        if transaction.get_connection().in_atomic_block:
            queryset = queryset.select_for_update(of=("self",))
        session = queryset.filter(
            id=session_id, match_id=self.match_id, category__slug="pictionary",
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Pictionary game not found.")
        return session

    @staticmethod
    def _serialize_word_search_state(session, user_id: int) -> dict[str, Any]:
        state = session.game_state or {}
        found_map = state.get("found_by_user") or {}
        found = list(found_map.get(str(user_id), []))
        if session.status == GameSession.Status.COMPLETED:
            return {"session_id": session.id, "phase": "completed", "result": state.get("result", {})}
        partner_id = session.match.user_b_id if user_id == session.match.user_a_id else session.match.user_a_id
        paths = state.get("paths") or {}
        return {
            "session_id": session.id,
            "phase": "waiting_for_match" if len(found) == len(state.get("words", [])) else "playing",
            "grid": state.get("grid", []), "words": state.get("words", []),
            "found_words": found,
            "found_paths": {word: paths[word] for word in found if word in paths},
            "found_count": len(found), "total_words": len(state.get("words", [])),
            "your_completed": len(found) == len(state.get("words", [])),
            "match_completed": len(found_map.get(str(partner_id), [])) == len(state.get("words", [])),
        }

    @staticmethod
    def _serialize_unscramble_state(session, user_id: int) -> dict[str, Any]:
        state = session.game_state or {}
        rounds = state.get("rounds") or []
        players = state.get("players") or {}
        own = players.get(str(user_id), {"solved": [], "mistakes": 0})
        partner_id = session.match.user_b_id if user_id == session.match.user_a_id else session.match.user_a_id
        partner = players.get(str(partner_id), {"solved": []})
        if session.status == GameSession.Status.COMPLETED:
            return {"session_id": session.id, "phase": "completed", "result": state.get("result", {})}
        solved = list(own.get("solved", []))
        return {
            "session_id": session.id,
            "phase": "waiting_for_match" if len(solved) == len(rounds) else "playing",
            "rounds": [{"index": index, "scrambled": item.get("scrambled", "")} for index, item in enumerate(rounds)],
            "solved_indices": solved, "solved_count": len(solved), "total_rounds": len(rounds),
            "mistakes": int(own.get("mistakes", 0)),
            "your_completed": len(solved) == len(rounds),
            "match_completed": len(partner.get("solved", [])) == len(rounds),
        }

    @database_sync_to_async
    def _get_unscramble_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="unscramble",
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Unscramble game not found.")
        return self._serialize_unscramble_state(session, user_id)

    @database_sync_to_async
    def _handle_unscramble_submit(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
            round_index = int(data.get("round_index"))
        except (TypeError, ValueError):
            raise ValueError("session_id and round_index are required.")
        submitted = str(data.get("answer", "")).strip()[:80]
        if not submitted:
            raise ValueError("Enter your answer.")
        normalize = lambda value: re.sub(r"[^a-z0-9]+", "", str(value).casefold())
        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related("match", "category").filter(
                id=session_id, match_id=self.match_id, category__slug="unscramble",
            ).first()
            if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("Unscramble game not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This game is already complete.")
            state = session.game_state or {}
            rounds = state.get("rounds") or []
            if round_index < 0 or round_index >= len(rounds):
                raise ValueError("That word is not part of this game.")
            players = state.get("players") or {}
            own = players.setdefault(str(user_id), {"solved": [], "mistakes": 0})
            solved = list(own.get("solved", []))
            if round_index in solved:
                raise ValueError("You already solved that word.")
            is_correct = normalize(submitted) == normalize(rounds[round_index].get("answer", ""))
            if not is_correct:
                own["mistakes"] = int(own.get("mistakes", 0)) + 1
                players[str(user_id)] = own
                state["players"] = players
                session.game_state = state
                session.save(update_fields=["game_state"])
                return {"event": "unscramble_update", "data": {"session_id": session.id},
                        "feedback": {"session_id": session.id, "correct": False}}
            solved.append(round_index)
            own["solved"] = solved
            players[str(user_id)] = own
            state["players"] = players
            total = len(rounds)
            partner_id = session.match.user_b_id if user_id == session.match.user_a_id else session.match.user_a_id
            partner = players.get(str(partner_id), {"solved": [], "mistakes": 0})
            if len(solved) == total and len(partner.get("solved", [])) == total:
                user_a = players.get(str(session.match.user_a_id), {"solved": [], "mistakes": 0})
                user_b = players.get(str(session.match.user_b_id), {"solved": [], "mistakes": 0})
                result_a = {"words": [item["answer"] for item in rounds], "score": max(0, total - int(user_a.get("mistakes", 0))), "mistakes": int(user_a.get("mistakes", 0))}
                result_b = {"words": [item["answer"] for item in rounds], "score": max(0, total - int(user_b.get("mistakes", 0))), "mistakes": int(user_b.get("mistakes", 0))}
                if result_a["mistakes"] < result_b["mistakes"]:
                    summary = "One player solved the words with fewer wrong guesses! 🧠"
                elif result_b["mistakes"] < result_a["mistakes"]:
                    summary = "One player solved the words with fewer wrong guesses! 🧠"
                else:
                    summary = "You both unscrambled every word with the same accuracy! 🎉"
                result = {"questions": [], "total_rounds": total, "user_a": result_a, "user_b": result_b, "summary": summary}
                state["result"] = result
                session.game_state = state
                session.status = GameSession.Status.COMPLETED
                session.save(update_fields=["game_state", "status"])
                message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={"event_type": "game_result", "match_id": self.match_id,
                                  "session_id": session.id, "category": "unscramble", "result": result},
                    status=Message.Status.DELIVERED, is_read=False,
                )
                return {"event": "game_session_completed", "data": {
                    "session_id": session.id, "completed": True,
                    "unscramble_state": {"session_id": session.id, "phase": "completed", "result": result},
                    "messages": [MessageSerializer(message).data],
                }, "feedback": {"session_id": session.id, "correct": True}}
            session.game_state = state
            session.save(update_fields=["game_state"])
            return {"event": "unscramble_update", "data": {"session_id": session.id},
                    "feedback": {"session_id": session.id, "correct": True}}

    @database_sync_to_async
    def _get_word_search_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="word_search",
        ).first()
        if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Word Search game not found.")
        return self._serialize_word_search_state(session, user_id)

    @database_sync_to_async
    def _handle_word_search_select(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        selection = data.get("cells")
        if not isinstance(selection, list) or not 2 <= len(selection) <= 12:
            raise ValueError("Select the letters of a word in a straight line.")
        clean_path = []
        for point in selection:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                raise ValueError("That selection is not a valid word path.")
            try:
                row, col = int(point[0]), int(point[1])
            except (TypeError, ValueError):
                raise ValueError("That selection is not a valid word path.")
            clean_path.append([row, col])
        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related("match", "category").filter(
                id=session_id, match_id=self.match_id, category__slug="word_search",
            ).first()
            if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("Word Search game not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This Word Search game is already complete.")
            state = session.game_state or {}
            grid, paths = state.get("grid") or [], state.get("paths") or {}
            if any(row < 0 or row >= len(grid) or col < 0 or col >= len(grid[row]) for row, col in clean_path):
                raise ValueError("That selection goes outside the grid.")
            found_map = state.get("found_by_user") or {}
            found = list(found_map.get(str(user_id), []))
            word = next((candidate for candidate, path in paths.items()
                         if clean_path == path or clean_path == list(reversed(path))), None)
            if word is None:
                raise ValueError("Those letters don't match a hidden word. Try again!")
            if word in found:
                raise ValueError("You already found that word.")
            found.append(word)
            found_map[str(user_id)] = found
            state["found_by_user"] = found_map
            total = len(state.get("words", []))
            own_complete = len(found) == total
            if own_complete and user_id not in (state.get("finish_order") or []):
                state.setdefault("finish_order", []).append(user_id)
            partner_id = session.match.user_b_id if user_id == session.match.user_a_id else session.match.user_a_id
            partner_complete = len(found_map.get(str(partner_id), [])) == total
            if own_complete and partner_complete:
                session.status = GameSession.Status.COMPLETED
                result = {
                    "questions": [], "total_words": total,
                    "user_a": {"words": found_map.get(str(session.match.user_a_id), []), "paths": {word: paths[word] for word in found_map.get(str(session.match.user_a_id), [])}, "score": len(found_map.get(str(session.match.user_a_id), []))},
                    "user_b": {"words": found_map.get(str(session.match.user_b_id), []), "paths": {word: paths[word] for word in found_map.get(str(session.match.user_b_id), [])}, "score": len(found_map.get(str(session.match.user_b_id), []))},
                    "grid": grid, "summary": "You both found every word! Compare your grids 🔎",
                }
                state["result"] = result
                session.game_state = state
                session.save(update_fields=["game_state", "status"])
                message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=result["summary"],
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={"event_type": "game_result", "match_id": self.match_id,
                                  "session_id": session.id, "category": "word_search", "result": result},
                    status=Message.Status.DELIVERED, is_read=False,
                )
                return {"event": "game_session_completed", "data": {
                    "session_id": session.id, "completed": True,
                    "word_search_state": {"session_id": session.id, "phase": "completed", "result": result},
                    "messages": [MessageSerializer(message).data],
                }}
            session.game_state = state
            session.save(update_fields=["game_state"])
            if own_complete:
                notify_game_turn(recipient_user_id=partner_id, game_name="Word Search", match_id=self.match_id)
            return {"event": "word_search_update", "data": {"session_id": session.id}}

    @database_sync_to_async
    def _handle_send_message(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        text = str(data.get("content", "")).strip()
        if not text:
            raise ValueError("content is required")

        client_message_id = data.get("client_message_id")
        if client_message_id is not None:
            client_message_id = str(client_message_id).strip() or None
            if client_message_id and len(client_message_id) > 64:
                raise ValueError("client_message_id must be 64 characters or fewer.")

        match = (
            Match.objects.only("id", "user_a_id", "user_b_id")
            .filter(id=self.match_id)
            .first()
        )
        if match is None:
            raise ValueError("Match not found.")
        if user_id not in {match.user_a_id, match.user_b_id}:
            raise ValueError("You are not part of this match.")

        reply_to_id = data.get("reply_to_id")
        if reply_to_id is not None:
            try:
                reply_to_id = int(reply_to_id)
            except (TypeError, ValueError):
                raise ValueError("Invalid reply target.")
            if not Message.objects.filter(
                id=reply_to_id, match_id=self.match_id, message_type=Message.MessageType.TEXT
            ).exists():
                raise ValueError("Message not found in this chat.")

        message_data = {
            "content": text,
            "message_type": Message.MessageType.TEXT,
            "game_payload": {},
            "reply_to_id": reply_to_id,
            "status": Message.Status.DELIVERED,
            "is_read": False,
        }
        if client_message_id:
            message, created = Message.objects.get_or_create(
                match_id=self.match_id,
                sender_id=user_id,
                client_message_id=client_message_id,
                defaults=message_data,
            )
            if not created and (
                message.content != text or message.reply_to_id != reply_to_id
            ):
                raise ValueError("This message retry key was already used for different content.")
        else:
            message = Message.objects.create(
                match_id=self.match_id,
                sender_id=user_id,
                **message_data,
            )
            created = True

        if created:
            recipient_user_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
            sender_name = get_user_model().objects.filter(pk=user_id).values_list("name", flat=True).first() or "Someone"
            notify_new_message(recipient_user_id=recipient_user_id, sender_name=sender_name, match_id=self.match_id)

        payload = MessageSerializer(message).data
        payload["match_id"] = self.match_id
        return payload

    @database_sync_to_async
    def _handle_start_game(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        category_slug = str(data.get("category", "")).strip()
        if not category_slug:
            raise ValueError("category is required")

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

            game = category.questions.filter(is_active=True, game__is_active=True).values_list("game_id", flat=True).first()
            if not game:
                raise ValueError("This game is being prepared. Try another game for now.")

            active_sessions = list(GameSession.objects.select_for_update(of=("self",)).select_related("category").filter(
                match_id=self.match_id, status=GameSession.Status.ACTIVE,
            ).order_by("created_at", "id"))

            # A fresh request replaces any earlier session. Keep old cards in the
            # chat so the history stays visible, but do not let a stale or one-sided
            # game prevent either player from starting another game.
            pending_sessions = list(GameSession.objects.select_for_update().filter(
                match_id=self.match_id, status=GameSession.Status.INVITED,
            ).order_by("created_at", "id"))
            closed_invites = []
            sessions_to_close = [*pending_sessions, *active_sessions]
            for old_session in sessions_to_close:
                was_invited = old_session.status == GameSession.Status.INVITED
                old_session.status = GameSession.Status.EXPIRED
                old_session.save(update_fields=["status"])
                old_message = Message.objects.filter(
                    match_id=self.match_id,
                    game_payload__session_id=old_session.id,
                    game_payload__event_type="game_invite" if was_invited else "game_started",
                ).order_by("-created_at", "-id").first()
                if old_message:
                    old_message.content = "Game invite replaced by a newer request" if was_invited else "Game closed — replaced by a new game request"
                    old_message.game_payload = {**old_message.game_payload, "invite_status": "replaced"}
                    old_message.save(update_fields=["content", "game_payload"])
                    closed_invites.append({
                        "session_id": old_session.id,
                        "invite_status": "replaced",
                        "message": MessageSerializer(old_message).data,
                    })

            user = User.objects.only("id").get(id=user_id)
            partner_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
            question_limit = 1 if category.slug in {"two_truths_and_a_lie", "rank_these", "tic_tac_toe", "dots_and_boxes", "pictionary", "word_search", "unscramble", "photo_scavenger_hunt", "word_association", "secret_song_pick", "collaborative_playlist", "mystery_playlist_mood", "snakes_ladders", "bingo", "spot_the_difference", "memory_match"} else 3 if category.slug == "caption_this" else 5
            if category.slug == "choose_your_adventure":
                questions = get_random_adventure_questions(user, exclude_user_ids=[partner_id])
            else:
                questions = get_random_questions(
                    user=user,
                    category=category.slug,
                    limit=question_limit,
                    exclude_user_ids=[partner_id],
                )
            if len(questions) < question_limit:
                raise ValueError("There are not enough active prompts for this game yet.")
            question_ids = [item["id"] for item in questions]
            initial_game_state = {}
            if category.slug == "tic_tac_toe":
                initial_game_state = {
                    "board": [None] * 9,
                    "marks": {str(user_id): "X", str(partner_id): "O"},
                    "turn_user_id": user_id,
                    "winner_user_id": None,
                    "winner_mark": None,
                    "winning_line": [],
                    "draw": False,
                    "last_move": None,
                }
            elif category.slug == "word_association":
                initial_game_state = {
                    "chain": [{"word": questions[0]["question_text"], "user_id": None}],
                    "turn_user_id": user_id,
                    "turns_played": 0,
                    "target_turns": 6,
                    "completed": False,
                }
            elif category.slug == "secret_song_pick":
                initial_game_state = {"phase": "picking", "revealed": False}
            elif category.slug == "collaborative_playlist":
                initial_game_state = {
                    "theme": questions[0]["question_text"],
                    "tracks": [],
                    "turn_user_id": user_id,
                    "turns_played": 0,
                    "target_turns": 6,
                    "completed": False,
                }
            elif category.slug == "mystery_playlist_mood":
                mood_options = [
                    str(item.get("text", "")).strip()
                    for item in questions[0].get("options", [])
                    if isinstance(item, dict) and str(item.get("text", "")).strip()
                ]
                if len(mood_options) < 2:
                    raise ValueError("Mystery Playlist Mood needs at least two mood choices.")
                initial_game_state = {
                    "phase": "mood_pick",
                    "mood_options": mood_options,
                    "mood_picks": {},
                    "mood_picks_count": 0,
                    "tracks": [],
                    "turn_user_id": None,
                    "turns_played": 0,
                    "target_turns": 6,
                    "completed": False,
                    "theme_prompt": questions[0]["question_text"],
                    "started_by_id": user_id,
                }
            elif category.slug == "snakes_ladders":
                challenge_rows = GameQuestion.objects.filter(
                    category=category, is_active=True, game__is_active=True,
                ).values("question_text", "options").order_by("order")
                challenges = []
                for row in challenge_rows:
                    options = [
                        str(option.get("text", "")).strip() if isinstance(option, dict) else str(option).strip()
                        for option in (row.get("options") or [])
                    ]
                    if len([option for option in options if option]) >= 2:
                        challenges.append({"prompt": row["question_text"], "options": options})
                random.shuffle(challenges)
                initial_game_state = create_snakes_ladders_state(
                    match.user_a_id, match.user_b_id, user_id, challenges,
                )
            elif category.slug == "bingo":
                prompt_rows = GameQuestion.objects.filter(
                    category=category, is_active=True, game__is_active=True,
                ).values("id", "question_text", "options").order_by("order")
                bingo_prompts = []
                for row in prompt_rows:
                    options = [
                        str(option.get("text", "")).strip() if isinstance(option, dict) else str(option).strip()
                        for option in (row.get("options") or [])
                    ]
                    if len([option for option in options if option]) >= 2:
                        bingo_prompts.append({"id": row["id"], "prompt": row["question_text"], "options": options})
                initial_game_state = create_bingo_state(
                    match.user_a_id, match.user_b_id, user_id, bingo_prompts,
                )
            session = GameSession.objects.create(
                match_id=self.match_id,
                game_id=game,
                category_id=category.id,
                created_by_id=user_id,
                started_by_id=user_id,
                current_question_index=0,
                status=GameSession.Status.INVITED,
                game_state=initial_game_state,
            )
            GameSessionQuestion.objects.bulk_create(
                [
                    GameSessionQuestion(
                        session_id=session.id,
                        question_id=item["id"],
                        order=index,
                    )
                    for index, item in enumerate(questions, start=1)
                ]
            )
            message_payload = {
                "event_type": "game_invite",
                "match_id": self.match_id,
                "session_id": session.id,
                "category": category.slug,
                "game_name": category.name,
                "invite_status": "pending",
                "questions": [] if category.slug in {"spot_the_difference", "memory_match"} else questions,
            }
            message = Message.objects.create(
                match_id=self.match_id,
                sender_id=user_id,
                content=f"Invited you to play {category.name} {category.emoji}",
                message_type=Message.MessageType.GAME_EVENT,
                game_payload=message_payload,
                status=Message.Status.DELIVERED,
                is_read=False,
            )

            sender_name = get_user_model().objects.filter(pk=user_id).values_list("name", flat=True).first() or "Someone"
            notify_new_message(recipient_user_id=partner_id, sender_name=sender_name, match_id=self.match_id)

        return {
            "session_id": session.id,
            "category": category.slug,
            "game_name": category.name,
            "message": MessageSerializer(message).data,
            "closed_invites": closed_invites,
        }

    @database_sync_to_async
    def _handle_game_invite_response(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        action = str(data.get("action", "")).strip().lower()
        if action not in {"accept", "decline"}:
            raise ValueError("Choose whether to accept or decline the game invite.")

        with transaction.atomic():
            match = Match.objects.select_for_update().filter(id=self.match_id).first()
            if match is None or user_id not in {match.user_a_id, match.user_b_id}:
                raise ValueError("You are not part of this chat.")
            session = (
                GameSession.objects.select_for_update(of=("self",))
                .select_related("match", "category")
                .filter(id=session_id, match_id=self.match_id)
                .first()
            )
            if session is None:
                raise ValueError("Game invite not found.")
            if user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("You are not part of this chat.")
            if user_id == session.started_by_id:
                raise ValueError("Your match needs to respond to this invite.")
            if session.status != GameSession.Status.INVITED:
                raise ValueError("This game invite is no longer pending.")

            invite_message = Message.objects.filter(
                match_id=self.match_id,
                game_payload__session_id=session.id,
                game_payload__event_type="game_invite",
            ).order_by("-created_at", "-id").first()

            event_name = "game_invite_updated"
            status_value = "declined"
            if timezone.now() - session.created_at > timedelta(days=7):
                session.status = GameSession.Status.EXPIRED
                status_value = "expired"
                action = "expired"
            elif action == "accept":
                session.status = GameSession.Status.ACTIVE
                status_value = "accepted"
                if session.category_id and session.category.slug == "pictionary":
                    prompt_rows = list(GameQuestion.objects.filter(
                        category__slug="pictionary_prompts", is_active=True, game__is_active=True,
                    ).values("id", "question_text").order_by("?")[:2])
                    if len(prompt_rows) < 2:
                        raise ValueError("Pictionary needs at least two active prompts.")
                    first_drawer = session.started_by_id
                    second_drawer = session.match.user_b_id if first_drawer == session.match.user_a_id else session.match.user_a_id
                    session.game_state = {
                        "phase": "drawing", "round_index": 0,
                        "scores": {str(first_drawer): 0, str(second_drawer): 0},
                        "rounds": [
                            {"drawer_id": first_drawer, "guesser_id": second_drawer, "prompt_id": prompt_rows[0]["id"], "prompt": prompt_rows[0]["question_text"], "strokes": [], "guess": None, "solved": False},
                            {"drawer_id": second_drawer, "guesser_id": first_drawer, "prompt_id": prompt_rows[1]["id"], "prompt": prompt_rows[1]["question_text"], "strokes": [], "guess": None, "solved": False},
                        ],
                    }
                if session.category_id and session.category.slug == "word_search":
                    bank = list(GameQuestion.objects.filter(
                        category__slug="word_search_words", is_active=True, game__is_active=True,
                    ).values_list("question_text", flat=True))
                    if len(bank) < 10:
                        raise ValueError("Word Search needs at least ten active words.")
                    chosen_words = random.sample(bank, 10)
                    grid, paths = _make_word_search(chosen_words)
                    session.game_state = {
                        "grid": grid, "words": chosen_words, "paths": paths,
                        "found_by_user": {
                            str(session.match.user_a_id): [],
                            str(session.match.user_b_id): [],
                        },
                        "finish_order": [],
                    }
                if session.category_id and session.category.slug == "dots_and_boxes":
                    match = session.match
                    session.game_state = {
                        "size": 4,
                        "horizontal": [[None for _ in range(3)] for _ in range(4)],
                        "vertical": [[None for _ in range(4)] for _ in range(3)],
                        "boxes": [[None for _ in range(3)] for _ in range(3)],
                        "marks": {str(match.user_a_id): "X", str(match.user_b_id): "O"},
                        "scores": {str(match.user_a_id): 0, str(match.user_b_id): 0},
                        "turn_user_id": session.started_by_id,
                        "winner_user_id": None, "winner_mark": None, "draw": False,
                        "completed": False, "last_move": None,
                    }
                if session.category_id and session.category.slug == "unscramble":
                    bank = [word for word in GameQuestion.objects.filter(
                        category__slug="unscramble_words", is_active=True, game__is_active=True,
                    ).values_list("question_text", flat=True) if len(word) >= 4]
                    if len(bank) < 10:
                        raise ValueError("Unscramble needs at least ten active words.")
                    answers = random.sample(bank, 10)
                    rounds = []
                    for answer in answers:
                        letters = list(str(answer).upper())
                        scrambled = str(answer).upper()
                        for _ in range(20):
                            random.shuffle(letters)
                            scrambled = "".join(letters)
                            if scrambled != str(answer).upper():
                                break
                        rounds.append({"answer": str(answer).upper(), "scrambled": scrambled})
                    session.game_state = {
                        "rounds": rounds,
                        "players": {
                            str(session.match.user_a_id): {"solved": [], "mistakes": 0},
                            str(session.match.user_b_id): {"solved": [], "mistakes": 0},
                        },
                    }
                if session.category_id and session.category.slug in {"spot_the_difference", "memory_match"}:
                    selected = GameSessionQuestion.objects.filter(session_id=session.id).select_related("question").order_by("order").first()
                    if selected is None:
                        raise ValueError("This game is being prepared. Try another game for now.")
                    config = selected.question.options or {}
                    if session.category.slug == "spot_the_difference":
                        session.game_state = create_spot_difference_state(
                            session.match.user_a_id, session.match.user_b_id, session.started_by_id, config,
                        )
                    else:
                        session.game_state = create_memory_match_state(
                            session.match.user_a_id, session.match.user_b_id, session.started_by_id, config,
                        )
            else:
                session.status = GameSession.Status.DECLINED
            session.save(update_fields=["status", "game_state"])

            if invite_message:
                invite_message.game_payload = {
                    **invite_message.game_payload,
                    "event_type": "game_started" if status_value == "accepted" else "game_invite",
                    "invite_status": status_value,
                }
                invite_message.content = {
                    "accepted": "Game accepted 🎲",
                    "declined": "Game invite declined",
                    "expired": "Game invite expired",
                }[status_value]
                invite_message.save(update_fields=["content", "game_payload"])

            if status_value == "accepted":
                question_ids = list(
                    GameSessionQuestion.objects.filter(session_id=session.id)
                    .order_by("order")
                    .values_list("question_id", flat=True)
                )
                QuestionExposure.objects.bulk_create(
                    [
                        QuestionExposure(user_id=participant_id, question_id=question_id)
                        for participant_id in (session.match.user_a_id, session.match.user_b_id)
                        for question_id in question_ids
                    ],
                    ignore_conflicts=True,
                )
                question_map = {
                    item["id"]: item
                    for item in GameQuestion.objects.filter(id__in=question_ids).values(
                        "id", "question_text", "options", "game_type"
                    )
                }
                questions = [question_map[qid] for qid in question_ids if qid in question_map]
                if session.category_id and session.category.slug == "pictionary":
                    questions = []
                if session.category_id and session.category.slug == "word_search":
                    questions = []
                if session.category_id and session.category.slug == "dots_and_boxes":
                    questions = []
                if session.category_id and session.category.slug == "unscramble":
                    questions = []
                if session.category_id and session.category.slug in {"spot_the_difference", "memory_match"}:
                    questions = []
                start_payload = {
                    "event_type": "game_started",
                    "match_id": self.match_id,
                    "session_id": session.id,
                    "category": session.category.slug if session.category_id else "this_or_that",
                    "game_name": session.category.name,
                    "invite_status": "accepted",
                    "questions": questions,
                }
                if start_payload["category"] == "tic_tac_toe":
                    start_payload["tic_tac_toe_state"] = session.game_state
                if start_payload["category"] == "word_association":
                    start_payload["word_association_state"] = session.game_state
                if start_payload["category"] == "secret_song_pick":
                    start_payload["secret_song_state"] = session.game_state
                if start_payload["category"] == "collaborative_playlist":
                    start_payload["collaborative_playlist_state"] = session.game_state
                if start_payload["category"] == "mystery_playlist_mood":
                    start_payload["mystery_playlist_mood_state"] = self._serialize_mystery_playlist_mood_state(
                        session.game_state or {}, session.match.user_a_id,
                    )
                if start_payload["category"] == "dots_and_boxes":
                    start_payload["dots_boxes_state"] = session.game_state
                if start_payload["category"] == "snakes_ladders":
                    start_payload["snakes_ladders_state"] = serialize_snakes_ladders_state(session.game_state or {}, user_id)
                if start_payload["category"] == "bingo":
                    start_payload["bingo_state"] = serialize_bingo_state(session.game_state or {}, user_id)
                if start_payload["category"] == "spot_the_difference":
                    start_payload["spot_difference_state"] = serialize_spot_difference_state(session.game_state or {})
                if start_payload["category"] == "memory_match":
                    start_payload["memory_match_state"] = serialize_memory_match_state(session.game_state or {})
                if invite_message:
                    invite_message.content = {
                        "guess_their_pick": "Pick your answer, then guess your match's. Everything stays private until you both finish!",
                        "emoji_decode": "Decode five emoji clues. Your guesses stay private until you both finish!",
                        "cipher_breaker": "Crack five secret messages. Use the hints if you need them; guesses reveal together!",
                        "photo_scavenger_hunt": "Find one photo for this prompt. Your photos stay private until you both share!",
                        "build_a_story": "Take turns adding a line. The full story stays secret until you both finish!",
                        "caption_this": "Write your own caption for each scene. Your captions reveal together!",
                        "tic_tac_toe": "Tic Tac Toe is ready. X goes first; your board saves between turns!",
                        "dots_and_boxes": "Dots and Boxes is ready. Connect a line, claim boxes, and keep playing when you score!",
                        "pictionary": "Pictionary is ready! Draw when you’re free, then your match can guess later.",
                        "word_search": "Your Word Search puzzle is ready. Find all ten words whenever you’re free!",
                        "unscramble": "Unscramble is ready! Solve the words whenever you have a moment.",
                        "word_association": "Word Association is ready! Take turns adding the first word that comes to mind.",
                        "secret_song_pick": "Pick one song for the prompt. Your choice stays secret until your match picks too.",
                        "collaborative_playlist": "Add songs one at a time and build a shared playlist together. Your progress saves between turns!",
                        "mystery_playlist_mood": "Choose your mood in secret. Once you both pick, take turns building a playlist for your combined vibe!",
                        "snakes_ladders": "Race to square 49! Take shortcuts, dodge snakes, and make secret picks together.",
                        "bingo": "Predict your match’s picks, earn stamps, and race to complete a line of five!",
                        "spot_the_difference": "Spot the Difference is ready! Take turns finding six changes in a little illustrated scene.",
                        "memory_match": "Memory Match is ready! Flip two cards, find pairs, and keep your turn when they match.",
                        "two_truths_and_a_lie": "Share three statements, then guess each other's lie. The lies stay hidden until both guesses are in!",
                    }.get(start_payload["category"], f"You both joined {session.category.name}. Pick your answers privately!")
                    invite_message.game_payload = start_payload
                    invite_message.save(update_fields=["content", "game_payload"])
                event_name = "game_started"
                event_data = {
                    "session_id": session.id,
                    "category": start_payload["category"],
                    "game_name": session.category.name,
                    "questions": questions,
                    "tic_tac_toe_state": start_payload.get("tic_tac_toe_state"),
                    "dots_boxes_state": start_payload.get("dots_boxes_state"),
                    "word_association_state": start_payload.get("word_association_state"),
                    "secret_song_state": start_payload.get("secret_song_state"),
                    "collaborative_playlist_state": start_payload.get("collaborative_playlist_state"),
                    "mystery_playlist_mood_state": self._serialize_mystery_playlist_mood_state(
                        session.game_state or {}, user_id,
                    ) if start_payload["category"] == "mystery_playlist_mood" else None,
                    "snakes_ladders_state": serialize_snakes_ladders_state(session.game_state or {}, user_id)
                    if start_payload["category"] == "snakes_ladders" else None,
                    "bingo_state": serialize_bingo_state(session.game_state or {}, user_id)
                    if start_payload["category"] == "bingo" else None,
                    "spot_difference_state": serialize_spot_difference_state(session.game_state or {})
                    if start_payload["category"] == "spot_the_difference" else None,
                    "memory_match_state": serialize_memory_match_state(session.game_state or {})
                    if start_payload["category"] == "memory_match" else None,
                    "message": MessageSerializer(invite_message).data if invite_message else None,
                }
            else:
                event_data = {
                    "session_id": session.id,
                    "invite_status": status_value,
                    "message": MessageSerializer(invite_message).data if invite_message else None,
                }

        return {"event": event_name, "data": event_data}

    @database_sync_to_async
    def _get_board_game_state(self, user_id: int, data: dict[str, Any], event_name: str) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        category = "tic_tac_toe" if event_name == "tic_tac_toe_state_request" else "dots_and_boxes"
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug=category,
            status__in=[GameSession.Status.ACTIVE, GameSession.Status.COMPLETED],
        ).first()
        if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("This board game is no longer active.")
        state = session.game_state or {}
        turn_user_id = state.get("turn_user_id")
        is_complete = bool(state.get("completed") or state.get("winner_user_id") or state.get("draw"))
        return {
            "session_id": session.id,
            "category": category,
            "game_name": session.category.name,
            "tic_tac_toe_state" if category == "tic_tac_toe" else "dots_boxes_state": state,
            "your_turn": not is_complete and int(turn_user_id or 0) == int(user_id),
            "waiting_for_match": not is_complete and int(turn_user_id or 0) != int(user_id),
            "state_sync": True,
        }

    @database_sync_to_async
    def _get_bingo_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="bingo",
            status__in=[GameSession.Status.ACTIVE, GameSession.Status.COMPLETED],
        ).first()
        if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Bingo game not found.")
        return {
            "session_id": session.id,
            "category": "bingo",
            "game_name": session.category.name,
            "bingo_state": serialize_bingo_state(session.game_state or {}, user_id),
            "state_sync": True,
        }

    @database_sync_to_async
    def _get_spot_memory_state(self, user_id: int, data: dict[str, Any], category: str) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug=category,
            status__in=[GameSession.Status.ACTIVE, GameSession.Status.COMPLETED],
        ).first()
        if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("This game is no longer active.")
        serializer = serialize_spot_difference_state if category == "spot_the_difference" else serialize_memory_match_state
        field = "spot_difference_state" if category == "spot_the_difference" else "memory_match_state"
        return {"session_id": session.id, "category": category, "game_name": session.category.name,
                field: serializer(session.game_state or {})}

    @database_sync_to_async
    def _handle_spot_memory_action(self, user_id: int, data: dict[str, Any], category: str) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related(
                "match", "category",
            ).filter(id=session_id, match_id=self.match_id, category__slug=category).first()
            if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("This game is no longer active.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This game is already finished.")
            apply = apply_spot_difference_action if category == "spot_the_difference" else apply_memory_match_action
            serializer = serialize_spot_difference_state if category == "spot_the_difference" else serialize_memory_match_state
            field = "spot_difference_state" if category == "spot_the_difference" else "memory_match_state"
            state = apply(session.game_state or {}, user_id, str(data.get("action", "")), data)
            completed_payload = None
            if state.get("completed"):
                session.status = GameSession.Status.COMPLETED
                if state.get("draw"):
                    summary = "You finished with the same score. A perfect tie! 🤝"
                else:
                    winner_name = User.objects.filter(pk=state.get("winner_user_id")).values_list("name", flat=True).first() or "A player"
                    summary = f"{winner_name} won {session.category.name}! 🎉"
                session.game_state = state
                session.save(update_fields=["game_state", "status"])
                result_message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={"event_type": "game_result", "match_id": self.match_id,
                                  "session_id": session.id, "category": category,
                                  "result": {**serializer(state), "questions": [], "summary": summary}},
                    status=Message.Status.DELIVERED, is_read=False,
                )
                completed_payload = {"session_id": session.id, "completed": True, field: serializer(state),
                                     "messages": [MessageSerializer(result_message).data]}
            else:
                session.game_state = state
                session.save(update_fields=["game_state"])
                next_user = state.get("turn_user_id")
                if next_user and int(next_user) != int(user_id):
                    name = "Spot the Difference" if category == "spot_the_difference" else "Memory Match"
                    notify_game_turn(recipient_user_id=int(next_user), game_name=name, match_id=self.match_id)
            return {"event": "spot_difference_update" if category == "spot_the_difference" else "memory_match_update",
                    "data": {"session_id": session.id, "category": category, field: serializer(state)},
                    "personalized_state": {"session_id": session.id, "category": category, field: serializer(state)},
                    "completed": completed_payload}

    @database_sync_to_async
    def _handle_bingo_action(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        action = str(data.get("action", "")).strip()
        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related(
                "match", "category",
            ).filter(id=session_id, match_id=self.match_id, category__slug="bingo").first()
            if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("Bingo game not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This Bingo game is already finished.")
            state = apply_bingo_action(session.game_state or {}, user_id, action, data)
            completed_payload = None
            if state.get("completed"):
                session.status = GameSession.Status.COMPLETED
                winner_id = state.get("winner_user_id")
                if state.get("draw"):
                    summary = "A perfect tie! You read each other equally well. 🤝"
                else:
                    winner_name = User.objects.filter(pk=winner_id).values_list("name", flat=True).first() or "A player"
                    summary = f"{winner_name} called Bingo first! 🎯"
                session.game_state = state
                session.save(update_fields=["game_state", "status"])
                result_message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={"event_type": "game_result", "match_id": self.match_id,
                                  "session_id": session.id, "category": "bingo",
                                  "result": {**serialize_bingo_state(state), "questions": [], "summary": summary}},
                    status=Message.Status.DELIVERED, is_read=False,
                )
                completed_payload = {
                    "session_id": session.id, "completed": True,
                    "bingo_state": serialize_bingo_state(state, user_id),
                    "messages": [MessageSerializer(result_message).data],
                }
            else:
                session.game_state = state
                session.save(update_fields=["game_state"])
                if action == "make_prediction":
                    answerer_id = int((state.get("pending") or {}).get("answerer_id") or 0)
                    if answerer_id:
                        notify_game_turn(recipient_user_id=answerer_id, game_name="Bingo: Are We in Sync?", match_id=self.match_id)
            return {
                "event": "bingo_update",
                "data": {"session_id": session.id, "bingo_state": serialize_bingo_state(state)},
                "personalized_state": {"session_id": session.id, "bingo_state": serialize_bingo_state(state, user_id)},
                "completed": completed_payload,
            }

    @database_sync_to_async
    def _get_snakes_ladders_state(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        session = GameSession.objects.select_related("match", "category").filter(
            id=session_id, match_id=self.match_id, category__slug="snakes_ladders",
            status__in=[GameSession.Status.ACTIVE, GameSession.Status.COMPLETED],
        ).first()
        if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValueError("Snakes and Ladders game not found.")
        state = session.game_state or {}
        return {
            "session_id": session.id,
            "category": "snakes_ladders",
            "game_name": session.category.name,
            "snakes_ladders_state": serialize_snakes_ladders_state(state, user_id),
            "state_sync": True,
        }

    @database_sync_to_async
    def _handle_snakes_ladders_action(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
        except (TypeError, ValueError):
            raise ValueError("session_id is required.")
        action = str(data.get("action", "")).strip()
        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related(
                "match", "category",
            ).filter(id=session_id, match_id=self.match_id, category__slug="snakes_ladders").first()
            if not session or user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("Snakes and Ladders game not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This game is already finished.")
            state = apply_snakes_ladders_action(session.game_state or {}, user_id, action, data)
            completed_payload = None
            if state.get("completed"):
                session.status = GameSession.Status.COMPLETED
                winner_id = state.get("winner_user_id")
                winner = User.objects.filter(pk=winner_id).values_list("name", flat=True).first() or "A player"
                summary = f"{winner} reached square 49 first! 🏁"
                session.game_state = state
                session.save(update_fields=["game_state", "status"])
                result_message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={"event_type": "game_result", "match_id": self.match_id,
                                  "session_id": session.id, "category": "snakes_ladders",
                                  "result": {**serialize_snakes_ladders_state(state), "questions": [], "summary": summary}},
                    status=Message.Status.DELIVERED, is_read=False,
                )
                completed_payload = {
                    "session_id": session.id, "completed": True,
                    "snakes_ladders_state": serialize_snakes_ladders_state(state, user_id),
                    "messages": [MessageSerializer(result_message).data],
                }
            else:
                session.game_state = state
                session.save(update_fields=["game_state"])
                next_user = state.get("turn_user_id")
                if next_user and int(next_user) != user_id:
                    notify_game_turn(recipient_user_id=int(next_user), game_name="Snakes, Ladders & Secrets", match_id=self.match_id)
            return {
                "event": "snakes_ladders_update",
                "data": {"session_id": session.id, "snakes_ladders_state": serialize_snakes_ladders_state(state)},
                "personalized_state": {"session_id": session.id, "snakes_ladders_state": serialize_snakes_ladders_state(state, user_id)},
                "completed": completed_payload,
            }

    @database_sync_to_async
    def _handle_tic_tac_toe_move(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
            cell_index = int(data.get("cell_index"))
        except (TypeError, ValueError):
            raise ValueError("session_id and cell_index are required.")
        if cell_index not in range(9):
            raise ValueError("Choose a cell on the board.")

        with transaction.atomic():
            session = (
                GameSession.objects.select_for_update(of=("self",))
                .select_related("match", "category")
                .filter(id=session_id, match_id=self.match_id)
                .first()
            )
            if session is None or not session.category_id or session.category.slug != "tic_tac_toe":
                raise ValueError("Tic Tac Toe game not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This game is already finished.")
            match = session.match
            if user_id not in {match.user_a_id, match.user_b_id}:
                raise ValueError("You are not part of this game.")

            state = session.game_state or {}
            board = list(state.get("board") or [None] * 9)
            if len(board) != 9:
                board = [None] * 9
            marks = state.get("marks") or {
                str(session.started_by_id): "X",
                str(match.user_b_id if session.started_by_id == match.user_a_id else match.user_a_id): "O",
            }
            if int(state.get("turn_user_id") or 0) != user_id:
                raise ValueError("It is your match's turn.")
            if board[cell_index] is not None:
                raise ValueError("That cell is already taken.")

            mark = marks.get(str(user_id))
            if mark not in {"X", "O"}:
                raise ValueError("Your board mark is unavailable.")
            board[cell_index] = mark
            winning_lines = (
                (0, 1, 2), (3, 4, 5), (6, 7, 8),
                (0, 3, 6), (1, 4, 7), (2, 5, 8),
                (0, 4, 8), (2, 4, 6),
            )
            winning_line = next((list(line) for line in winning_lines if all(board[index] == mark for index in line)), [])
            winner_user_id = user_id if winning_line else None
            draw = not winning_line and all(board)
            next_user_id = None if winning_line or draw else (
                match.user_b_id if user_id == match.user_a_id else match.user_a_id
            )
            state = {
                "board": board,
                "marks": marks,
                "turn_user_id": next_user_id,
                "winner_user_id": winner_user_id,
                "winner_mark": mark if winner_user_id else None,
                "winning_line": winning_line,
                "draw": bool(draw),
                "last_move": {"user_id": user_id, "cell_index": cell_index, "mark": mark},
            }
            session.game_state = state
            if winner_user_id or draw:
                session.status = GameSession.Status.COMPLETED
                session.save(update_fields=["game_state", "status"])
                result = {
                    **state,
                    "user_a_mark": marks.get(str(match.user_a_id)),
                    "user_b_mark": marks.get(str(match.user_b_id)),
                    "questions": [],
                    "summary": f"{mark} wins! Great game 🎉" if winner_user_id else "It’s a draw! Nice game 🤝",
                }
                result_payload = {
                    "event_type": "game_result",
                    "match_id": self.match_id,
                    "session_id": session.id,
                    "category": "tic_tac_toe",
                    "result": result,
                }
                result_message = Message.objects.create(
                    match_id=self.match_id,
                    sender_id=user_id,
                    content=result["summary"],
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload=result_payload,
                    status=Message.Status.DELIVERED,
                    is_read=False,
                )
                return {
                    "event": "game_session_completed",
                    "data": {
                        "session_id": session.id,
                        "completed": True,
                        "result": result,
                        "tic_tac_toe_state": state,
                        "messages": [MessageSerializer(result_message).data],
                    },
                }

            session.save(update_fields=["game_state"])
            if next_user_id:
                notify_game_turn(recipient_user_id=next_user_id, game_name="Tic Tac Toe", match_id=self.match_id)
            return {
                "event": "tic_tac_toe_update",
                "data": {"session_id": session.id, "tic_tac_toe_state": state},
            }

    @database_sync_to_async
    def _handle_dots_boxes_move(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        try:
            session_id = int(data.get("session_id"))
            row = int(data.get("row"))
            col = int(data.get("col"))
        except (TypeError, ValueError):
            raise ValueError("session_id, row, and col are required.")
        orientation = str(data.get("orientation", "")).strip().lower()
        if orientation in {"h", "horizontal"}:
            orientation = "horizontal"
        elif orientation in {"v", "vertical"}:
            orientation = "vertical"
        else:
            raise ValueError("Choose a horizontal or vertical line.")

        with transaction.atomic():
            session = GameSession.objects.select_for_update(of=("self",)).select_related("match", "category").filter(
                id=session_id, match_id=self.match_id, category__slug="dots_and_boxes",
            ).first()
            if session is None or user_id not in {session.match.user_a_id, session.match.user_b_id}:
                raise ValueError("Dots and Boxes game not found.")
            if session.status != GameSession.Status.ACTIVE:
                raise ValueError("This game is already finished.")
            state = session.game_state or {}
            if state.get("completed"):
                raise ValueError("This board is already complete.")
            if int(state.get("turn_user_id") or 0) != user_id:
                raise ValueError("It is your match's turn.")
            horizontal = state.get("horizontal") or []
            vertical = state.get("vertical") or []
            edge_grid = horizontal if orientation == "horizontal" else vertical
            if row < 0 or row >= len(edge_grid) or col < 0 or col >= len(edge_grid[row]):
                raise ValueError("That line is outside the board.")
            if edge_grid[row][col] is not None:
                raise ValueError("That line has already been drawn.")

            mark = (state.get("marks") or {}).get(str(user_id))
            if mark not in {"X", "O"}:
                raise ValueError("Your board mark is unavailable.")
            edge_grid[row][col] = mark
            boxes = state.get("boxes") or [[None for _ in range(3)] for _ in range(3)]
            candidate_boxes = (
                [(row - 1, col), (row, col)] if orientation == "horizontal"
                else [(row, col - 1), (row, col)]
            )
            claimed = 0
            for box_row, box_col in candidate_boxes:
                if not (0 <= box_row < 3 and 0 <= box_col < 3) or boxes[box_row][box_col] is not None:
                    continue
                all_edges = (
                    horizontal[box_row][box_col] is not None
                    and horizontal[box_row + 1][box_col] is not None
                    and vertical[box_row][box_col] is not None
                    and vertical[box_row][box_col + 1] is not None
                )
                if all_edges:
                    boxes[box_row][box_col] = mark
                    claimed += 1

            scores = state.get("scores") or {str(session.match.user_a_id): 0, str(session.match.user_b_id): 0}
            scores[str(user_id)] = int(scores.get(str(user_id), 0)) + claimed
            remaining = sum(edge is None for line in horizontal for edge in line) + sum(
                edge is None for line in vertical for edge in line
            )
            completed = remaining == 0
            partner_id = session.match.user_b_id if user_id == session.match.user_a_id else session.match.user_a_id
            next_user_id = None if completed else user_id if claimed else partner_id
            state.update({
                "horizontal": horizontal, "vertical": vertical, "boxes": boxes,
                "scores": scores, "turn_user_id": next_user_id,
                "completed": completed,
                "last_move": {"user_id": user_id, "orientation": orientation, "row": row, "col": col, "claimed": claimed},
            })
            if completed:
                score_a = int(scores.get(str(session.match.user_a_id), 0))
                score_b = int(scores.get(str(session.match.user_b_id), 0))
                winner_mark = "X" if score_a > score_b else "O" if score_b > score_a else None
                winner_id = session.match.user_a_id if score_a > score_b else session.match.user_b_id if score_b > score_a else None
                state.update({"winner_user_id": winner_id, "winner_mark": winner_mark, "draw": winner_id is None})
                session.game_state = state
                session.status = GameSession.Status.COMPLETED
                session.save(update_fields=["game_state", "status"])
                summary = f"{winner_mark} wins with {max(score_a, score_b)} boxes! Great game 🎉" if winner_mark else "It’s a tie! You claimed the same number of boxes 🤝"
                result = {
                    **state,
                    "user_a_mark": "X", "user_b_mark": "O",
                    "user_a_score": score_a, "user_b_score": score_b,
                    "questions": [], "summary": summary,
                }
                result_message = Message.objects.create(
                    match_id=self.match_id, sender_id=user_id, content=summary,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload={"event_type": "game_result", "match_id": self.match_id,
                                  "session_id": session.id, "category": "dots_and_boxes", "result": result},
                    status=Message.Status.DELIVERED, is_read=False,
                )
                return {"event": "game_session_completed", "data": {
                    "session_id": session.id, "completed": True, "result": result,
                    "dots_boxes_state": state, "messages": [MessageSerializer(result_message).data],
                }}

            session.game_state = state
            session.save(update_fields=["game_state"])
            if next_user_id != user_id:
                notify_game_turn(recipient_user_id=next_user_id, game_name="Dots and Boxes", match_id=self.match_id)
            return {"event": "dots_boxes_update", "data": {"session_id": session.id, "dots_boxes_state": state}}

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
        predicted_text_answer = str(data.get("predicted_text_answer", "")).strip()
        story_text = str(data.get("story_text", "")).strip()
        caption_text = str(data.get("caption_text", "")).strip()
        truth_statements = data.get("truth_statements")
        raw_lie_index = data.get("lie_index")
        raw_guessed_lie_index = data.get("guessed_lie_index")
        raw_ranking = data.get("ranking")

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
                    "current_question_index",
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

            is_guess_game = bool(session.category_id and session.category.slug == "guess_their_pick")
            is_story_game = bool(session.category_id and session.category.slug == "build_a_story")
            is_caption_game = bool(session.category_id and session.category.slug == "caption_this")
            is_two_truths_game = bool(session.category_id and session.category.slug == "two_truths_and_a_lie")
            is_adventure_game = bool(session.category_id and session.category.slug == "choose_your_adventure")
            is_rank_these = bool(session.category_id and session.category.slug == "rank_these")
            is_emoji_decode = bool(session.category_id and session.category.slug == "emoji_decode")
            is_cipher_breaker = bool(session.category_id and session.category.slug == "cipher_breaker")
            is_photo_scavenger = bool(session.category_id and session.category.slug == "photo_scavenger_hunt")
            is_secret_song = bool(session.category_id and session.category.slug == "secret_song_pick")
            if is_guess_game and not predicted_text_answer:
                raise ValueError("Choose your match's pick before submitting.")
            if is_story_game and not story_text:
                raise ValueError("Add a story line before submitting.")
            if is_story_game and len(story_text) > 240:
                raise ValueError("Story lines must be 240 characters or fewer.")
            if is_caption_game and not caption_text:
                raise ValueError("Write a caption before submitting.")
            if is_caption_game and len(caption_text) > 200:
                raise ValueError("Captions must be 200 characters or fewer.")
            question = GameQuestion.objects.only("id", "options").get(id=question_id)
            ranking = []
            if is_rank_these:
                valid_item_ids = [str(item.get("id")) for item in (question.options or []) if isinstance(item, dict)]
                if not isinstance(raw_ranking, list):
                    raise ValueError("Arrange every item before submitting your ranking.")
                ranking = [str(item) for item in raw_ranking]
                if len(valid_item_ids) < 2 or len(ranking) != len(valid_item_ids) or set(ranking) != set(valid_item_ids):
                    raise ValueError("Your ranking must include each item exactly once.")

            question_ids = list(
                GameSessionQuestion.objects.filter(session_id=session.id)
                .order_by("order", "id")
                .values_list("question_id", flat=True)
            )
            if question_id not in question_ids:
                raise ValueError("Question does not belong to this session.")

            partner_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
            if is_two_truths_game:
                existing_response = GameResponse.objects.filter(
                    session_id=session.id, user_id=user_id, question_id=question_id
                ).first()
                if raw_guessed_lie_index is not None:
                    if existing_response is None:
                        raise ValueError("Submit your three statements before guessing.")
                    partner_response = GameResponse.objects.filter(
                        session_id=session.id, user_id=partner_id, question_id=question_id
                    ).first()
                    if partner_response is None or len(partner_response.truth_statements or []) != 3:
                        raise ValueError("Your match's statements are not ready yet.")
                    try:
                        guessed_lie_index = int(raw_guessed_lie_index)
                    except (TypeError, ValueError):
                        raise ValueError("Choose which statement you think is the lie.")
                    if guessed_lie_index not in range(3):
                        raise ValueError("Choose one of the three statements.")
                    if existing_response.guessed_lie_index is not None:
                        if existing_response.guessed_lie_index != guessed_lie_index:
                            raise ValueError("Your guess is already locked in.")
                    else:
                        existing_response.guessed_lie_index = guessed_lie_index
                        existing_response.save(update_fields=["guessed_lie_index"])
                else:
                    if existing_response is not None:
                        raise ValueError("Your statements are already locked in.")
                    if not isinstance(truth_statements, list) or len(truth_statements) != 3:
                        raise ValueError("Enter exactly three statements.")
                    normalized_statements = [str(value).strip() for value in truth_statements]
                    if any(not value for value in normalized_statements):
                        raise ValueError("All three statements need an answer.")
                    if any(len(value) > 160 for value in normalized_statements):
                        raise ValueError("Each statement must be 160 characters or fewer.")
                    try:
                        lie_index = int(raw_lie_index)
                    except (TypeError, ValueError):
                        raise ValueError("Mark which of your three statements is the lie.")
                    if lie_index not in range(3):
                        raise ValueError("Mark one of the three statements as the lie.")
                    existing_response = GameResponse.objects.create(
                        session_id=session.id, user_id=user_id, question_id=question_id,
                        truth_statements=normalized_statements, lie_index=lie_index,
                    )

                partner_response = GameResponse.objects.filter(
                    session_id=session.id, user_id=partner_id, question_id=question_id
                ).first()
                both_submitted = bool(
                    existing_response and len(existing_response.truth_statements or []) == 3
                    and partner_response and len(partner_response.truth_statements or []) == 3
                )
                statement_sets = None
                if both_submitted:
                    statement_sets = {
                        str(user_id): existing_response.truth_statements,
                        str(partner_id): partner_response.truth_statements,
                    }
                own_guessed = existing_response.guessed_lie_index is not None
                partner_guessed = bool(partner_response and partner_response.guessed_lie_index is not None)
                if not (both_submitted and own_guessed and partner_guessed):
                    if len(existing_response.truth_statements or []) == 3 and not partner_guessed:
                        notify_game_turn(recipient_user_id=partner_id, match_id=self.match_id)
                    return {
                        "event": "game_update",
                        "data": {
                            "session_id": session.id,
                            "question_id": question_id,
                            "user_id": user_id,
                            "answered_question_ids": [question_id] if existing_response.truth_statements else [],
                            "guessed_question_ids": [question_id] if own_guessed else [],
                            "statement_sets": statement_sets,
                            "user_completed": own_guessed,
                            "match_completed": partner_guessed,
                            "waiting_for_match": bool(own_guessed and not partner_guessed),
                            "your_turn": bool(both_submitted and not own_guessed),
                            "completed": False,
                        },
                    }
                text_answer = ""
                selected_option = None
                response_created = False

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
                if not text_answer and not is_story_game and not is_caption_game and not is_two_truths_game and not is_rank_these:
                    raise ValueError("selected_option or text_answer is required.")

            if is_secret_song:
                if not text_answer:
                    raise ValueError("Add the song title and artist before submitting.")
                if len(text_answer) > 160:
                    raise ValueError("Song picks must be 160 characters or fewer.")
                if text_answer == "__photo_scavenger_submission__":
                    raise ValueError("Enter a song title and artist.")

            if is_emoji_decode or is_cipher_breaker:
                if not text_answer:
                    raise ValueError("Enter your cipher guess before submitting.")
                if len(text_answer) > 100:
                    raise ValueError("Guesses must be 100 characters or fewer.")
            if is_photo_scavenger and text_answer != "__photo_scavenger_submission__":
                raise ValueError("Share your photo before locking in your hunt response.")

            if is_guess_game:
                question_options = {
                    str(item.get("text", "")).strip()
                    for item in (question.options or [])
                    if isinstance(item, dict)
                }
                if text_answer not in question_options or predicted_text_answer not in question_options:
                    raise ValueError("Choose answers from the options shown.")
            if is_story_game:
                prompt = str(question.question_text or "").strip()
                if not prompt:
                    raise ValueError("This story prompt is unavailable.")
            if is_adventure_game:
                valid_choices = {
                    str(item.get("text", "")).strip()
                    for item in (question.options or []) if isinstance(item, dict)
                }
                if text_answer not in valid_choices:
                    raise ValueError("Choose one of the adventure options shown.")

            if not is_two_truths_game:
                existing_response = GameResponse.objects.filter(
                    session_id=session.id,
                    user_id=user_id,
                    question_id=question_id,
                ).first()
                response_created = existing_response is None
                if existing_response:
                    if is_photo_scavenger and existing_response.photo and not existing_response.text_answer:
                        existing_response.text_answer = text_answer
                        existing_response.save(update_fields=["text_answer"])
                        response_created = True
                    same_option = existing_response.selected_option_id == (selected_option.id if selected_option else None)
                    same_text = existing_response.text_answer == text_answer
                    same_prediction = existing_response.predicted_text_answer == predicted_text_answer
                    saved_story = caption_text if is_caption_game else story_text
                    same_story = existing_response.story_text == saved_story
                    same_ranking = existing_response.ranking == ranking
                    if not (is_photo_scavenger and response_created) and not (same_option and same_text and same_prediction and same_story and same_ranking):
                        raise ValueError("Your pick is already locked in.")
                else:
                    GameResponse.objects.create(
                        session_id=session.id,
                        user_id=user_id,
                        question_id=question_id,
                        selected_option_id=selected_option.id if selected_option else None,
                        text_answer=text_answer,
                        predicted_text_answer=predicted_text_answer,
                        story_text=caption_text if is_caption_game else story_text,
                        ranking=ranking,
                    )

            own_answered_ids = set(
                GameResponse.objects.filter(session_id=session.id, user_id=user_id)
                .values_list("question_id", flat=True)
            )
            partner_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
            partner_answered_ids = set(
                GameResponse.objects.filter(session_id=session.id, user_id=partner_id)
                .values_list("question_id", flat=True)
            )
            if is_guess_game:
                own_answered_ids = set(
                    GameResponse.objects.filter(
                        session_id=session.id, user_id=user_id, predicted_text_answer__gt=""
                    ).values_list("question_id", flat=True)
                )
                partner_answered_ids = set(
                    GameResponse.objects.filter(
                        session_id=session.id, user_id=partner_id, predicted_text_answer__gt=""
                    ).values_list("question_id", flat=True)
                )
            elif is_story_game or is_caption_game:
                own_answered_ids = set(
                    GameResponse.objects.filter(
                        session_id=session.id, user_id=user_id, story_text__gt=""
                    ).values_list("question_id", flat=True)
                )
                partner_answered_ids = set(
                    GameResponse.objects.filter(
                        session_id=session.id, user_id=partner_id, story_text__gt=""
                    ).values_list("question_id", flat=True)
                )
            elif is_two_truths_game:
                own_answered_ids = set(
                    GameResponse.objects.filter(
                        session_id=session.id, user_id=user_id, guessed_lie_index__isnull=False
                    ).values_list("question_id", flat=True)
                )
                partner_answered_ids = set(
                    GameResponse.objects.filter(
                        session_id=session.id, user_id=partner_id, guessed_lie_index__isnull=False
                    ).values_list("question_id", flat=True)
                )
            elif is_photo_scavenger:
                own_answered_ids = set(GameResponse.objects.filter(
                    session_id=session.id, user_id=user_id,
                    text_answer="__photo_scavenger_submission__",
                ).values_list("question_id", flat=True))
                partner_answered_ids = set(GameResponse.objects.filter(
                    session_id=session.id, user_id=partner_id,
                    text_answer="__photo_scavenger_submission__",
                ).values_list("question_id", flat=True))
            elif is_secret_song:
                own_answered_ids = set(GameResponse.objects.filter(
                    session_id=session.id, user_id=user_id, text_answer__gt="",
                ).values_list("question_id", flat=True))
                partner_answered_ids = set(GameResponse.objects.filter(
                    session_id=session.id, user_id=partner_id, text_answer__gt="",
                ).values_list("question_id", flat=True))
            own_complete = len(own_answered_ids) >= len(question_ids)
            partner_complete = len(partner_answered_ids) >= len(question_ids)

            if not (own_complete and partner_complete):
                if own_complete and not partner_complete and response_created:
                    notify_game_turn(recipient_user_id=partner_id, match_id=self.match_id)
                return {
                    "event": "game_update",
                    "data": {
                        "session_id": session.id,
                        "question_id": question_id,
                        "user_id": user_id,
                        "answered_count": len(own_answered_ids),
                        "user_completed": own_complete,
                        "match_completed": partner_complete,
                        "completed": False,
                    },
                }

            session.status = GameSession.Status.COMPLETED
            session.current_question_index = len(question_ids)
            session.save(update_fields=["status", "current_question_index"])

            result_messages = []
            for round_number, reveal_question_id in enumerate(question_ids, start=1):
                if is_two_truths_game or is_rank_these:
                    continue
                question = GameQuestion.objects.only("question_text").get(id=reveal_question_id)
                round_responses = list(
                    GameResponse.objects.filter(
                        session_id=session.id, question_id=reveal_question_id
                    ).select_related("selected_option")
                )
                answer_by_user = {
                    answer.user_id: (
                        answer.selected_option.option_text
                        if answer.selected_option_id
                        else answer.text_answer
                    )
                    for answer in round_responses
                }
                if is_story_game or is_caption_game:
                    answer_by_user = {answer.user_id: answer.story_text for answer in round_responses}
                if is_photo_scavenger:
                    answer_by_user = {answer.user_id: answer.photo_caption for answer in round_responses}
                round_result_text = generate_question_result(
                    session_id=session.id, question_id=reveal_question_id
                )
                round_payload = {
                    "event_type": "game_round_result",
                    "match_id": self.match_id,
                    "session_id": session.id,
                    "question_id": reveal_question_id,
                    "round_number": round_number,
                    "question_text": question.question_text,
                    "result_text": round_result_text,
                    "answers": [
                        {"user_id": match.user_a_id, "answer": answer_by_user.get(match.user_a_id, "")},
                        {"user_id": match.user_b_id, "answer": answer_by_user.get(match.user_b_id, "")},
                    ],
                }
                if is_story_game or is_caption_game:
                    round_payload["prompt"] = question.question_text
                round_message = Message.objects.create(
                    match_id=self.match_id,
                    sender_id=user_id,
                    content=round_result_text,
                    message_type=Message.MessageType.GAME_EVENT,
                    game_payload=round_payload,
                    status=Message.Status.DELIVERED,
                    is_read=False,
                )
                result_messages.append(round_message)

            result = calculate_game_result(session.id)
            category_slug = session.category.slug if session.category_id else "this_or_that"
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
                "event": "game_session_completed",
                "data": {
                    "session_id": session.id,
                    "completed": True,
                    "result": result,
                    "messages": [
                        *[MessageSerializer(message).data for message in result_messages],
                        MessageSerializer(result_message).data,
                    ],
                },
            }
