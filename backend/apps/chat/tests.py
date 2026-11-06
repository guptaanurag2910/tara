from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
from tempfile import TemporaryDirectory
import base64

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.games.models import Game, GameCategory, GameQuestion, GameSession, GameSessionQuestion, GameResponse
from apps.matching.models import Match

from .consumers import ChatConsumer
from .models import Message
from .services import create_game_event_message

User = get_user_model()


def create_user(
    *,
    email: str,
    name: str,
    phone_number: str,
    gender: str,
    preference: str,
    latitude: str = "12.971600",
    longitude: str = "77.594600",
):
    return User.objects.create_user(
        email=email,
        password="TaraDemo@123",
        name=name,
        phone_number=phone_number,
        date_of_birth=date(1995, 1, 1),
        gender=gender,
        preference=preference,
        birth_place="Bengaluru, Karnataka, India",
        latitude=Decimal(latitude),
        longitude=Decimal(longitude),
        is_default_location=False,
        is_birth_time_default=False,
        bio="",
        interests=[],
    )


class ChatApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = create_user(
            email="chat-a@example.com",
            name="Chat A",
            phone_number="+919200000001",
            gender="male",
            preference="female",
        )
        self.user_b = create_user(
            email="chat-b@example.com",
            name="Chat B",
            phone_number="+919200000002",
            gender="female",
            preference="male",
        )
        self.outsider = create_user(
            email="chat-c@example.com",
            name="Chat C",
            phone_number="+919200000003",
            gender="female",
            preference="male",
        )

        self.matched = Match.objects.create(
            user_a=self.user_a,
            user_b=self.user_b,
            kundali_score=30,
            personality_score=80,
            final_score=91,
            match_type="Cosmic Match",
            insight_text="Strong potential.",
            status=Match.Status.MATCHED,
            is_visible=True,
        )
        self.suggested = Match.objects.create(
            user_a=self.user_a,
            user_b=self.outsider,
            kundali_score=21,
            personality_score=65,
            final_score=66,
            match_type="Cosmic Match",
            insight_text="Not matched yet.",
            status=Match.Status.SUGGESTED,
            is_visible=True,
        )
        self.game_category = GameCategory.objects.create(
            name="This or That",
            slug="this_or_that",
            emoji="⚖️",
            is_active=True,
        )
        self.game = Game.objects.create(
            name="This or That",
            emoji="⚖️",
            description="Quick choices",
            type=Game.Type.CHOICE,
            is_active=True,
        )
        self.questions = [
            GameQuestion.objects.create(
                game=self.game,
                category=self.game_category,
                game_type=GameQuestion.GameType.THIS_OR_THAT,
                question_text=question_text,
                options=[{"text": left}, {"text": right}],
                order=index,
                is_active=True,
            )
            for index, (question_text, left, right) in enumerate(
                [
                    ("Dogs or cats?", "Dogs", "Cats"),
                    ("Tea or coffee?", "Tea", "Coffee"),
                    ("Beach or mountains?", "Beach", "Mountains"),
                    ("Stay in or go out?", "Stay in", "Go out"),
                    ("Sweet or savory?", "Sweet", "Savory"),
                ],
                start=1,
            )
        ]

    @patch("apps.chat.views.safe_group_send")
    def test_opening_matched_chat_marks_incoming_messages_read(self, mock_group_send):
        message = Message.objects.create(
            match=self.matched,
            sender=self.user_b,
            content="Hello from B",
            message_type=Message.MessageType.TEXT,
            game_payload={},
            status=Message.Status.DELIVERED,
            is_read=False,
        )

        self.client.force_authenticate(self.user_a)
        response = self.client.get(f"/api/chat/{self.matched.id}/messages/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["content"], "Hello from B")
        self.assertEqual(payload[0]["sender_id"], self.user_b.id)
        message.refresh_from_db()
        self.assertTrue(message.is_read)
        self.assertEqual(message.status, Message.Status.READ)
        mock_group_send.assert_called_once()
        self.assertEqual(mock_group_send.call_args.args[1]["payload"]["event"], "read_receipt")

    @patch("apps.chat.views.safe_group_send")
    def test_conversation_preview_does_not_mark_messages_read(self, mock_group_send):
        message = Message.objects.create(
            match=self.matched,
            sender=self.user_b,
            content="Unread preview",
            message_type=Message.MessageType.TEXT,
            game_payload={},
            status=Message.Status.DELIVERED,
            is_read=False,
        )
        self.client.force_authenticate(self.user_a)

        response = self.client.get(f"/api/chat/{self.matched.id}/messages/?mark_read=false")

        self.assertEqual(response.status_code, 200)
        message.refresh_from_db()
        self.assertFalse(message.is_read)
        self.assertEqual(message.status, Message.Status.DELIVERED)
        mock_group_send.assert_not_called()

    def test_chat_history_backfills_legacy_game_invite_status(self):
        session = GameSession.objects.create(
            match=self.matched,
            game=self.game,
            category=self.game_category,
            started_by=self.user_a,
            status=GameSession.Status.ACTIVE,
        )
        Message.objects.create(
            match=self.matched,
            sender=self.user_a,
            content="Started a game: this_or_that",
            message_type=Message.MessageType.GAME_EVENT,
            game_payload={"event_type": "game_started", "session_id": session.id, "category": "this_or_that"},
        )
        self.client.force_authenticate(self.user_a)

        active_response = self.client.get(f"/api/chat/{self.matched.id}/messages/")
        self.assertEqual(active_response.json()[0]["game_payload"]["invite_status"], "accepted")

        session.status = GameSession.Status.EXPIRED
        session.save(update_fields=["status"])
        expired_response = self.client.get(f"/api/chat/{self.matched.id}/messages/")
        self.assertEqual(expired_response.json()[0]["game_payload"]["invite_status"], "expired")

    @patch("apps.chat.views.safe_group_send")
    def test_rest_message_create_broadcasts_live_update(self, mock_group_send):
        self.client.force_authenticate(self.user_a)

        response = self.client.post(
            f"/api/chat/{self.matched.id}/message/",
            {"content": "REST fallback still updates live chat"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Message.objects.filter(
                match=self.matched,
                sender=self.user_a,
                content="REST fallback still updates live chat",
                message_type=Message.MessageType.TEXT,
            ).exists()
        )

        mock_group_send.assert_called_once()
        group_name, event_payload = mock_group_send.call_args.args
        self.assertEqual(group_name, f"match_{self.matched.id}")
        self.assertEqual(event_payload["type"], "ws.event")
        self.assertEqual(event_payload["event"], "new_message")
        self.assertEqual(event_payload["data"]["content"], "REST fallback still updates live chat")
        self.assertEqual(event_payload["data"]["sender_id"], self.user_a.id)

    def test_chat_endpoints_reject_non_matched_pairs(self):
        self.client.force_authenticate(self.user_a)

        get_response = self.client.get(f"/api/chat/{self.suggested.id}/messages/")
        post_response = self.client.post(
            f"/api/chat/{self.suggested.id}/message/",
            {"content": "Should not send"},
            format="json",
        )

        self.assertEqual(get_response.status_code, 404)
        self.assertEqual(post_response.status_code, 404)
        self.assertFalse(Message.objects.filter(match=self.suggested, content="Should not send").exists())

    def test_reply_and_reaction_persist_for_both_participants(self):
        original = Message.objects.create(match=self.matched, sender=self.user_a, content="Favorite place?", status=Message.Status.DELIVERED)
        self.client.force_authenticate(self.user_b)
        reply = self.client.post(f"/api/chat/{self.matched.id}/message/", {
            "content": "By the sea", "reply_to_id": original.id,
        }, format="json")
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.json()["reply_to"]["id"], original.id)
        self.assertEqual(reply.json()["reply_to"]["content"], "Favorite place?")

        url = f"/api/chat/{self.matched.id}/messages/{original.id}/reaction/"
        self.assertEqual(self.client.post(url, {"emoji": "❤️"}, format="json").status_code, 200)
        self.assertEqual(self.client.post(url, {"emoji": "❤️"}, format="json").json()["reactions"], {})
        self.assertEqual(self.client.post(url, {"emoji": "✨"}, format="json").json()["reactions"], {"✨": [self.user_b.id]})
        self.client.force_authenticate(self.user_a)
        history = self.client.get(f"/api/chat/{self.matched.id}/messages/").json()
        self.assertEqual(history[0]["reactions"], {"✨": [self.user_b.id]})
        self.assertEqual(history[1]["reply_to"]["id"], original.id)

    def test_reply_and_reaction_reject_other_chats_and_outsiders(self):
        original = Message.objects.create(match=self.matched, sender=self.user_a, content="Hello")
        self.client.force_authenticate(self.user_a)
        invalid_reply = self.client.post(f"/api/chat/{self.suggested.id}/message/", {
            "content": "No", "reply_to_id": original.id,
        }, format="json")
        self.assertEqual(invalid_reply.status_code, 404)
        self.assertEqual(self.client.post(f"/api/chat/{self.matched.id}/message/", {
            "content": "No", "reply_to_id": 999999,
        }, format="json").status_code, 400)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.post(
            f"/api/chat/{self.matched.id}/messages/{original.id}/reaction/", {"emoji": "👍"}, format="json",
        ).status_code, 404)

    def test_socket_message_keeps_reply_reference(self):
        original = Message.objects.create(match=self.matched, sender=self.user_a, content="First message")
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        payload = consumer._handle_send_message.__wrapped__(consumer, self.user_b.id, {
            "content": "A reply", "reply_to_id": original.id,
        })
        self.assertEqual(payload["reply_to"]["id"], original.id)
        self.assertEqual(Message.objects.get(pk=payload["id"]).reply_to_id, original.id)

    @patch("apps.chat.views.safe_group_send")
    @patch("apps.chat.views.notify_new_message")
    def test_message_retry_key_returns_the_original_message_without_duplicates(self, notify, broadcast):
        self.client.force_authenticate(self.user_a)
        url = f"/api/chat/{self.matched.id}/message/"
        payload = {"content": "Retry-safe hello", "client_message_id": "mobile-message-123"}

        first = self.client.post(url, payload, format="json")
        retried = self.client.post(url, payload, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(first.json()["id"], retried.json()["id"])
        self.assertEqual(retried.json()["client_message_id"], payload["client_message_id"])
        self.assertEqual(Message.objects.filter(match=self.matched, sender=self.user_a).count(), 1)
        self.assertEqual(notify.call_count, 1)
        self.assertEqual(broadcast.call_count, 1)

        conflicting_retry = self.client.post(
            url,
            {**payload, "content": "Different content"},
            format="json",
        )
        self.assertEqual(conflicting_retry.status_code, 409)

    def test_socket_message_retry_key_returns_the_original_message(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        payload = {"content": "Socket hello", "client_message_id": "socket-message-123"}

        first = consumer._handle_send_message.__wrapped__(consumer, self.user_a.id, payload)
        retried = consumer._handle_send_message.__wrapped__(consumer, self.user_a.id, payload)

        self.assertEqual(first["id"], retried["id"])
        self.assertEqual(retried["client_message_id"], payload["client_message_id"])
        self.assertEqual(Message.objects.filter(match=self.matched, sender=self.user_a).count(), 1)

    def test_game_event_retry_key_returns_the_original_event(self):
        payload = {"session_id": 99, "question_id": 17}
        first = create_game_event_message(
            match_id=self.matched.id,
            sender_id=self.user_a.id,
            content="A game prompt",
            event_type="game_question",
            payload=payload,
            dedupe_key="game_question:99:17",
            broadcast=False,
        )
        retried = create_game_event_message(
            match_id=self.matched.id,
            sender_id=self.user_a.id,
            content="A game prompt",
            event_type="game_question",
            payload=payload,
            dedupe_key="game_question:99:17",
            broadcast=False,
        )

        self.assertEqual(first.id, retried.id)
        self.assertEqual(
            Message.objects.filter(match=self.matched, game_payload__event_id="game_question:99:17").count(),
            1,
        )

    def test_consumer_access_helper_requires_matched_status(self):
        consumer = ChatConsumer()

        self.assertTrue(async_to_sync(consumer._user_can_access_match)(self.matched.id, self.user_a.id))
        self.assertFalse(async_to_sync(consumer._user_can_access_match)(self.suggested.id, self.user_a.id))
        self.assertFalse(async_to_sync(consumer._user_can_access_match)(self.suggested.id, self.outsider.id))

    def test_game_flow_creates_session_questions_responses_and_result_message(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id

        start_result = consumer._handle_start_game.__wrapped__(
            consumer,
            self.user_a.id,
            {"category": "this_or_that"},
        )

        self.assertEqual(start_result["category"], "this_or_that")
        questions = start_result["message"]["game_payload"]["questions"]
        self.assertEqual(len(questions), 5)
        session_id = start_result["session_id"]

        session = GameSession.objects.get(id=session_id)
        self.assertEqual(session.status, GameSession.Status.INVITED)
        self.assertEqual(session.category_id, self.game_category.id)
        self.assertEqual(GameSessionQuestion.objects.filter(session=session).count(), 5)

        accepted = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )
        self.assertEqual(accepted["event"], "game_started")
        session.refresh_from_db()
        self.assertEqual(session.status, GameSession.Status.ACTIVE)

        for question in questions:
            payload = {
                "session_id": session_id,
                "question_id": question["id"],
                "selected_option": question["options"][0]["text"],
                "text_answer": question["options"][0]["text"],
            }
            update_a = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, payload)
            self.assertEqual(update_a["event"], "game_update")
            self.assertFalse(
                Message.objects.filter(
                    match=self.matched,
                    game_payload__event_type="game_result",
                    game_payload__session_id=session_id,
                ).exists()
            )
            update_b = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, payload)

        self.assertEqual(update_b["event"], "game_session_completed")
        self.assertTrue(update_b["data"]["completed"])
        result = update_b["data"]["result"]
        self.assertEqual(result["total"], 5)
        self.assertEqual(result["matched"], 5)

        session.refresh_from_db()
        self.assertEqual(session.status, GameSession.Status.COMPLETED)
        self.assertEqual(GameResponse.objects.filter(session=session).count(), 10)

        result_message = Message.objects.filter(
            match=self.matched,
            message_type=Message.MessageType.GAME_EVENT,
            game_payload__event_type="game_result",
        ).latest("id")
        self.assertEqual(result_message.game_payload["category"], "this_or_that")
        self.assertEqual(result_message.content, result["summary"])

    def test_tic_tac_toe_turn_updates_the_persisted_board(self):
        category = GameCategory.objects.create(
            name="Tic Tac Toe", slug="tic_tac_toe", emoji="⭕", is_active=True
        )
        game = Game.objects.create(
            name="Tic Tac Toe", emoji="⭕", description="Three in a row",
            type=Game.Type.CHOICE, is_active=True,
        )
        GameQuestion.objects.create(
            game=game, category=category,
            game_type=GameQuestion.GameType.THIS_OR_THAT,
            question_text="Who goes first?", options=[], order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id

        invite = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "tic_tac_toe"}
        )
        session_id = invite["session_id"]
        accepted = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )
        self.assertEqual(accepted["event"], "game_started")

        move = consumer._handle_tic_tac_toe_move.__wrapped__(
            consumer, self.user_a.id, {"session_id": session_id, "cell_index": 0}
        )
        self.assertEqual(move["event"], "tic_tac_toe_update")
        state = move["data"]["tic_tac_toe_state"]
        self.assertEqual(state["board"][0], "X")
        self.assertEqual(state["turn_user_id"], self.user_b.id)
        self.assertEqual(GameSession.objects.get(id=session_id).game_state["board"][0], "X")

    def test_spot_the_difference_state_reconnects_and_completion_is_saved_for_both_players(self):
        category = GameCategory.objects.create(
            name="Spot the Difference", slug="spot_the_difference", emoji="🔍", is_active=True,
        )
        game = Game.objects.create(
            name=category.name, emoji=category.emoji, description="Find six differences",
            type=Game.Type.CHOICE, is_active=True,
        )
        scene = {
            "scene_id": "test_scene", "title": "Test scene",
            "differences": [
                {"id": f"spot_{index}", "x": 100 + index * 120, "y": 200, "radius": 20,
                 "label": f"Change {index + 1}"}
                for index in range(6)
            ],
        }
        GameQuestion.objects.create(
            game=game, category=category, game_type=GameQuestion.GameType.THIS_OR_THAT,
            question_text="Find what changed", options=scene, order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        invite = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        session_id = invite["session_id"]
        started = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        self.assertEqual(started["event"], "game_started")
        self.assertIn("spot_difference_state", started["data"])

        first_move = consumer._handle_spot_memory_action.__wrapped__(
            consumer, self.user_a.id, {"session_id": session_id, "action": "spot", "x": 100, "y": 200}, category.slug,
        )
        self.assertEqual(first_move["event"], "spot_difference_update")
        self.assertEqual(first_move["data"]["spot_difference_state"]["scores"][str(self.user_a.id)], 1)
        rejoined = consumer._get_spot_memory_state.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id}, category.slug,
        )
        self.assertEqual(rejoined["spot_difference_state"]["found"], ["spot_0"])
        self.assertNotIn("differences", rejoined["spot_difference_state"])

        session = GameSession.objects.get(id=session_id)
        while not session.game_state["completed"]:
            state = session.game_state
            current_user = int(state["turn_user_id"])
            difference = next(item for item in state["differences"] if item["id"] not in state["found"])
            update = consumer._handle_spot_memory_action.__wrapped__(
                consumer, current_user,
                {"session_id": session_id, "action": "spot", "x": difference["x"], "y": difference["y"]},
                category.slug,
            )
            session.refresh_from_db()

        session.refresh_from_db()
        self.assertEqual(session.status, GameSession.Status.COMPLETED)
        self.assertTrue(update["completed"]["completed"])
        result = Message.objects.get(
            match=self.matched, game_payload__event_type="game_result",
            game_payload__session_id=session_id,
        )
        self.assertEqual(result.game_payload["category"], category.slug)
        self.assertEqual(len(result.game_payload["result"]["differences"]), 6)

    def test_memory_match_turn_sync_and_result_message_persist_when_board_finishes(self):
        category = GameCategory.objects.create(
            name="Memory Match", slug="memory_match", emoji="🃏", is_active=True,
        )
        game = Game.objects.create(
            name=category.name, emoji=category.emoji, description="Find eight pairs",
            type=Game.Type.CHOICE, is_active=True,
        )
        deck = {"title": "Test deck", "cards": [
            {"id": f"face_{index}", "face": f"face {index}"} for index in range(8)
        ]}
        GameQuestion.objects.create(
            game=game, category=category, game_type=GameQuestion.GameType.THIS_OR_THAT,
            question_text="Find your pairs", options=deck, order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        invite = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        session_id = invite["session_id"]
        started = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        self.assertEqual(started["event"], "game_started")
        self.assertIn("memory_match_state", started["data"])

        session = GameSession.objects.get(id=session_id)
        cards_by_face = {}
        for card in session.game_state["cards"]:
            cards_by_face.setdefault(card["face"], []).append(card["id"])
        turn_user = int(session.game_state["turn_user_id"])
        first_pair = next(iter(cards_by_face.values()))
        consumer._handle_spot_memory_action.__wrapped__(
            consumer, turn_user, {"session_id": session_id, "action": "flip", "card_id": first_pair[0]}, category.slug,
        )
        first_update = consumer._handle_spot_memory_action.__wrapped__(
            consumer, turn_user, {"session_id": session_id, "action": "flip", "card_id": first_pair[1]}, category.slug,
        )
        self.assertEqual(first_update["event"], "memory_match_update")
        rejoined = consumer._get_spot_memory_state.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id}, category.slug,
        )
        self.assertEqual(rejoined["memory_match_state"]["scores"][str(turn_user)], 1)

        for pair in list(cards_by_face.values())[1:]:
            session.refresh_from_db()
            turn_user = int(session.game_state["turn_user_id"])
            consumer._handle_spot_memory_action.__wrapped__(
                consumer, turn_user, {"session_id": session_id, "action": "flip", "card_id": pair[0]}, category.slug,
            )
            update = consumer._handle_spot_memory_action.__wrapped__(
                consumer, turn_user, {"session_id": session_id, "action": "flip", "card_id": pair[1]}, category.slug,
            )

        session.refresh_from_db()
        self.assertEqual(session.status, GameSession.Status.COMPLETED)
        self.assertTrue(update["completed"]["completed"])
        result = Message.objects.get(
            match=self.matched, game_payload__event_type="game_result",
            game_payload__session_id=session_id,
        )
        self.assertEqual(result.game_payload["category"], category.slug)
        self.assertEqual(len(result.game_payload["result"]["cards"]), 16)

    def _create_guess_their_pick(self):
        category = GameCategory.objects.create(
            name="Guess Their Pick", slug="guess_their_pick", emoji="🔮", is_active=True
        )
        game = Game.objects.create(
            name="Guess Their Pick", emoji="🔮", description="Pick and predict",
            type=Game.Type.CHOICE, is_active=True,
        )
        options = [{"text": text} for text in ("Explore", "Relax", "Meet friends", "Get outdoors")]
        questions = [
            GameQuestion.objects.create(
                game=game,
                category=category,
                game_type=GameQuestion.GameType.PREDICT_ME,
                question_text=f"What would you choose {index}?",
                options=options,
                order=index,
                is_active=True,
            )
            for index in range(1, 6)
        ]
        return category, game, questions

    def test_emoji_decode_answers_stay_private_then_reveal_with_score(self):
        category = GameCategory.objects.create(
            name="Emoji Decode", slug="emoji_decode", emoji="🧩", is_active=True,
        )
        game = Game.objects.create(
            name="Emoji Decode", emoji="🧩", description="Decode emoji clues",
            type=Game.Type.TEXT, is_active=True,
        )
        for order, (clue, answer) in enumerate([
            ("🌧️🐱🐶", "raining cats and dogs"), ("🧊☕", "iced coffee"),
            ("🍯🌙", "honeymoon"), ("🌊🐴", "seahorse"), ("🦷🧚", "tooth fairy"),
        ], start=1):
            GameQuestion.objects.create(
                game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=clue, trait_mapping={"answer": answer}, order=order, is_active=True,
            )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "emoji_decode"})
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        questions = started["message"]["game_payload"]["questions"]
        self.assertEqual(len(questions), 5)
        self.assertTrue(all("answer" not in row and "trait_mapping" not in row for row in questions))
        expected_by_clue = {
            "🌧️🐱🐶": "raining cats and dogs", "🧊☕": "iced coffee",
            "🍯🌙": "honeymoon", "🌊🐴": "seahorse", "🦷🧚": "tooth fairy",
        }

        for question in questions:
            update = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": session_id, "question_id": question["id"],
                "text_answer": expected_by_clue[question["question_text"]] if question["question_text"] == "🌧️🐱🐶" else "wrong guess",
            })
            self.assertEqual(update["event"], "game_update")
        self.assertFalse(Message.objects.filter(
            match=self.matched, game_payload__event_type__in=["game_round_result", "game_result"],
            game_payload__session_id=session_id,
        ).exists())

        final = None
        for question in questions:
            final = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "question_id": question["id"],
                "text_answer": "RAINING CATS AND DOGS" if question["question_text"] == "🌧️🐱🐶" else "nope",
            })
        result = final["data"]["result"]
        self.assertEqual(result["user_a_score"], 1)
        self.assertEqual(result["user_b_score"], 1)
        self.assertEqual(result["total"], 10)
        rain_round = next(item for item in result["questions"] if item["question"] == "🌧️🐱🐶")
        self.assertEqual(rain_round["answer"], "raining cats and dogs")

    def test_cipher_breaker_answers_stay_private_then_reveal_with_score(self):
        category = GameCategory.objects.create(
            name="Cipher Breaker", slug="cipher_breaker", emoji="🔐", is_active=True,
        )
        game = Game.objects.create(
            name="Cipher Breaker", emoji="🔐", description="Crack secret messages",
            type=Game.Type.TEXT, is_active=True,
        )
        puzzle_rows = [
            ("VHFUHW PHVVDJH", "secret message"),
            ("EUHDN WKH LFH", "break the ice"),
            ("PLGQLJKW VQDFN", "midnight snack"),
            ("IROORZ WKH VWDUV", "follow the stars"),
            ("RSHQ VHVDPH", "open sesame"),
        ]
        questions = [
            GameQuestion.objects.create(
                game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=ciphertext, options=[{"hint": "A small hint"}],
                trait_mapping={"answer": answer}, order=index, is_active=True,
            )
            for index, (ciphertext, answer) in enumerate(puzzle_rows, start=1)
        ]
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "cipher_breaker"},
        )
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        public_questions = started["message"]["game_payload"]["questions"]
        self.assertEqual(len(public_questions), 5)
        self.assertTrue(all("answer" not in row and "trait_mapping" not in row for row in public_questions))
        self.assertTrue(all(row["options"][0]["hint"] == "A small hint" for row in public_questions))
        answers_by_ciphertext = dict(puzzle_rows)

        for question in public_questions:
            update = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": session_id, "question_id": question["id"],
                "text_answer": answers_by_ciphertext[question["question_text"]],
            })
            self.assertEqual(update["event"], "game_update")
        self.assertFalse(Message.objects.filter(
            match=self.matched, game_payload__event_type__in=["game_round_result", "game_result"],
            game_payload__session_id=session_id,
        ).exists())

        final = None
        for question in public_questions:
            final = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "question_id": question["id"],
                "text_answer": answers_by_ciphertext[question["question_text"]].upper(),
            })
        self.assertEqual(final["event"], "game_session_completed")
        result = final["data"]["result"]
        self.assertEqual(result["user_a_score"], 5)
        self.assertEqual(result["user_b_score"], 5)
        self.assertEqual(result["total"], 10)
        self.assertEqual(result["round_count"], 5)

    def test_photo_scavenger_upload_is_private_until_both_players_submit(self):
        category = GameCategory.objects.create(
            name="Photo Scavenger Hunt", slug="photo_scavenger_hunt", emoji="📸", is_active=True,
        )
        game = Game.objects.create(
            name="Photo Scavenger Hunt", emoji="📸", description="Share a photo",
            type=Game.Type.TEXT, is_active=True,
        )
        GameQuestion.objects.create(
            game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
            question_text="Something that feels like Sunday", options=[], order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "photo_scavenger_hunt"},
        )
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        question = started["message"]["game_payload"]["questions"][0]
        image_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/"
            "lV8AAAAASUVORK5CYII="
        )
        with TemporaryDirectory(prefix="tara-scavenger-test-") as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(user=self.user_a)
            first_upload = self.client.post(
                f"/api/games/session/{session_id}/photo/",
                {"question_id": question["id"], "caption": "My quiet morning", "image": SimpleUploadedFile("morning.png", image_bytes, content_type="image/png")},
                format="multipart",
            )
            self.assertEqual(first_upload.status_code, 201)
            self.assertNotIn("photo", first_upload.data)
            self.assertEqual(self.client.get(
                f"/api/games/session/{session_id}/photo/reveal/?question_id={question['id']}&user_id={self.user_a.id}"
            ).status_code, 404)
            first_answer = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": session_id, "question_id": question["id"],
                "text_answer": "__photo_scavenger_submission__",
            })
            self.assertFalse(first_answer["data"].get("completed", False))

            self.client.force_authenticate(user=self.user_b)
            second_upload = self.client.post(
                f"/api/games/session/{session_id}/photo/",
                {"question_id": question["id"], "caption": "A sunny walk", "image": SimpleUploadedFile("walk.png", image_bytes, content_type="image/png")},
                format="multipart",
            )
            self.assertEqual(second_upload.status_code, 201)
            final_answer = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "question_id": question["id"],
                "text_answer": "__photo_scavenger_submission__",
            })
            result = final_answer["data"]["result"]
            self.assertEqual(result["questions"][0]["user_a"], "My quiet morning")
            self.assertTrue(result["questions"][0]["user_a_photo_url"])

            revealed = self.client.get(result["questions"][0]["user_a_photo_url"])
            self.assertEqual(revealed.status_code, 200)
            self.assertEqual(revealed["Cache-Control"], "private, no-store")
            self.client.force_authenticate(user=self.outsider)
            self.assertEqual(self.client.get(result["questions"][0]["user_a_photo_url"]).status_code, 404)

    def test_word_association_saves_alternating_turns_and_reveals_chain(self):
        category = GameCategory.objects.create(
            name="Word Association", slug="word_association", emoji="💭", is_active=True,
        )
        game = Game.objects.create(
            name="Word Association", emoji="💭", description="Build a word chain",
            type=Game.Type.TEXT, is_active=True,
        )
        for order, starter in enumerate(("Ocean", "Coffee", "Adventure"), start=1):
            GameQuestion.objects.create(
                game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=starter, options=[], order=order, is_active=True,
            )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "word_association"},
        )
        session_id = started["session_id"]
        accepted = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        state = accepted["data"]["word_association_state"]
        self.assertEqual(state["turn_user_id"], self.user_a.id)
        self.assertEqual(len(state["chain"]), 1)
        question_id = started["message"]["game_payload"]["questions"][0]["id"]
        with self.assertRaisesRegex(ValueError, "match's turn"):
            consumer._handle_word_association_submit.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "word": "Sea",
            })
        with self.assertRaisesRegex(ValueError, "one word"):
            consumer._handle_word_association_submit.__wrapped__(consumer, self.user_a.id, {
                "session_id": session_id, "word": "Blue sea",
            })

        final = None
        for index, word in enumerate(("Sea", "Blue", "Sky", "Cloud", "Soft", "Pillow")):
            player_id = self.user_a.id if index % 2 == 0 else self.user_b.id
            final = consumer._handle_word_association_submit.__wrapped__(consumer, player_id, {
                "session_id": session_id, "word": word,
            })
            if index == 0:
                live_state = consumer._get_word_association_state.__wrapped__(
                    consumer, self.user_b.id, {"session_id": session_id},
                )
                self.assertEqual(len(live_state["state"]["chain"]), 2)
                self.assertEqual(live_state["state"]["turn_user_id"], self.user_b.id)
                self.assertFalse(live_state["state"]["completed"])

        self.assertEqual(final["event"], "game_result")
        result = final["data"]["result"]
        self.assertEqual(result["round_count"], 6)
        self.assertEqual(len(result["questions"][0]["chain"]), 7)
        self.assertEqual(result["questions"][0]["chain"][0]["word"], state["chain"][0]["word"])
        self.assertEqual(result["questions"][0]["chain"][-1]["word"], "Pillow")
        self.assertEqual(final["data"]["word_association_state"]["chain"][-1]["word"], "Pillow")
        self.assertTrue(final["data"]["word_association_state"]["completed"])
        completed_state = consumer._get_word_association_state.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id},
        )
        self.assertEqual(completed_state["state"]["chain"][-1]["word"], "Pillow")
        self.assertTrue(completed_state["state"]["completed"])
        self.assertEqual(GameSession.objects.get(id=session_id).status, GameSession.Status.COMPLETED)

    def test_secret_song_pick_keeps_song_private_until_both_players_submit(self):
        category = GameCategory.objects.create(
            name="Secret Song Pick", slug="secret_song_pick", emoji="🎵", is_active=True,
        )
        game = Game.objects.create(
            name="Secret Song Pick", emoji="🎵", description="Pick a song",
            type=Game.Type.TEXT, is_active=True,
        )
        question = GameQuestion.objects.create(
            game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
            question_text="A song that always lifts your mood", options=[], order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "secret_song_pick"},
        )
        session_id = started["session_id"]
        accepted = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        self.assertEqual(accepted["event"], "game_started")
        self.assertEqual(len(accepted["data"]["questions"]), 1)

        first = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
            "session_id": session_id, "question_id": question.id, "text_answer": "Dreams — Fleetwood Mac",
        })
        self.assertEqual(first["event"], "game_update")
        self.assertTrue(first["data"]["user_completed"])
        self.assertNotIn("Dreams", str(first["data"]))
        self.assertFalse(Message.objects.filter(
            match=self.matched, game_payload__event_type="game_result",
            game_payload__session_id=session_id,
        ).exists())

        final = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
            "session_id": session_id, "question_id": question.id, "text_answer": "Dreams — Fleetwood Mac",
        })
        self.assertEqual(final["event"], "game_session_completed")
        result = final["data"]["result"]
        self.assertTrue(result["questions"][0]["match"])
        self.assertEqual(result["questions"][0]["user_a"], "Dreams — Fleetwood Mac")
        self.assertEqual(result["questions"][0]["user_b"], "Dreams — Fleetwood Mac")
        self.assertEqual(GameSession.objects.get(id=session_id).status, GameSession.Status.COMPLETED)

    def test_collaborative_playlist_alternates_and_persists_six_song_turns(self):
        category = GameCategory.objects.create(
            name="Collaborative Playlist", slug="collaborative_playlist", emoji="🎧", is_active=True,
        )
        game = Game.objects.create(
            name="Collaborative Playlist", emoji="🎧", description="Build a playlist",
            type=Game.Type.TEXT, is_active=True,
        )
        for order, theme in enumerate(("Songs for a road trip", "Songs for a cozy night"), start=1):
            GameQuestion.objects.create(
                game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=theme, options=[], order=order, is_active=True,
            )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "collaborative_playlist"},
        )
        session_id = started["session_id"]
        accepted = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )
        state = accepted["data"]["collaborative_playlist_state"]
        self.assertEqual(state["turn_user_id"], self.user_a.id)
        self.assertEqual(state["tracks"], [])

        with self.assertRaisesRegex(ValueError, "your match's turn"):
            consumer._handle_collaborative_playlist_submit.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "title": "Dreams", "artist": "Fleetwood Mac",
            })

        final = None
        for index in range(6):
            player_id = self.user_a.id if index % 2 == 0 else self.user_b.id
            final = consumer._handle_collaborative_playlist_submit.__wrapped__(consumer, player_id, {
                "session_id": session_id,
                "title": f"Song {index + 1}",
                "artist": f"Artist {index + 1}",
                "note": "Road trip favorite",
            })
            if index < 5:
                self.assertEqual(final["event"], "collaborative_playlist_update")
                persisted = consumer._get_collaborative_playlist_state.__wrapped__(
                    consumer, self.user_b.id, {"session_id": session_id},
                )
                self.assertEqual(len(persisted["state"]["tracks"]), index + 1)
                self.assertEqual(persisted["state"]["turn_user_id"], self.user_b.id if index % 2 == 0 else self.user_a.id)
                self.assertFalse(persisted["state"]["completed"])

        self.assertEqual(final["event"], "game_result")
        self.assertEqual(len(final["data"]["result"]["tracks"]), 6)
        self.assertEqual(final["data"]["result"]["tracks"][0]["title"], "Song 1")
        self.assertEqual(GameSession.objects.get(id=session_id).status, GameSession.Status.COMPLETED)

    def test_mystery_playlist_mood_keeps_mood_private_then_builds_playlist(self):
        category = GameCategory.objects.create(
            name="Mystery Playlist Mood", slug="mystery_playlist_mood", emoji="🎶", is_active=True,
        )
        game = Game.objects.create(
            name="Mystery Playlist Mood", emoji="🎶", description="Choose a vibe",
            type=Game.Type.TEXT, is_active=True,
        )
        question = GameQuestion.objects.create(
            game=game, category=category, game_type=GameQuestion.GameType.OPEN_ENDED,
            question_text="Choose your mood", options=[{"text": mood} for mood in ("Dreamy", "Nostalgic")],
            order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": "mystery_playlist_mood"},
        )
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"},
        )

        first_mood = consumer._handle_mystery_playlist_mood_submit.__wrapped__(consumer, self.user_a.id, {
            "session_id": session_id, "action": "mood_pick", "mood": "Dreamy",
        })
        self.assertEqual(first_mood["event"], "mystery_playlist_mood_update")
        self.assertNotIn("mood_picks", first_mood["data"]["state"])
        self.assertNotIn("own_mood", first_mood["data"]["state"])
        own_state = consumer._get_mystery_playlist_mood_state.__wrapped__(
            consumer, self.user_a.id, {"session_id": session_id},
        )["state"]
        partner_state = consumer._get_mystery_playlist_mood_state.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id},
        )["state"]
        self.assertEqual(own_state["own_mood"], "Dreamy")
        self.assertTrue(own_state["own_mood_submitted"])
        self.assertFalse(partner_state["own_mood_submitted"])
        self.assertIsNone(partner_state["own_mood"])

        revealed = consumer._handle_mystery_playlist_mood_submit.__wrapped__(consumer, self.user_b.id, {
            "session_id": session_id, "action": "mood_pick", "mood": "Nostalgic",
        })
        self.assertEqual(revealed["data"]["state"]["phase"], "songs")
        self.assertEqual(revealed["data"]["state"]["mood_picks"][str(self.user_a.id)], "Dreamy")
        self.assertEqual(revealed["data"]["state"]["turn_user_id"], self.user_a.id)
        with self.assertRaisesRegex(ValueError, "your match's turn"):
            consumer._handle_mystery_playlist_mood_submit.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "action": "add_song", "title": "Dreams", "artist": "Fleetwood Mac",
            })

        final = None
        for index in range(6):
            player_id = self.user_a.id if index % 2 == 0 else self.user_b.id
            final = consumer._handle_mystery_playlist_mood_submit.__wrapped__(consumer, player_id, {
                "session_id": session_id, "action": "add_song",
                "title": f"Track {index + 1}", "artist": f"Artist {index + 1}",
            })
        self.assertEqual(final["event"], "game_result")
        self.assertEqual(final["data"]["result"]["mood_a"], "Dreamy")
        self.assertEqual(final["data"]["result"]["mood_b"], "Nostalgic")
        self.assertEqual(len(final["data"]["result"]["tracks"]), 6)
        self.assertEqual(GameSession.objects.get(id=session_id).status, GameSession.Status.COMPLETED)

    def test_guess_their_pick_keeps_answers_private_until_both_finish(self):
        category, game, questions = self._create_guess_their_pick()
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(
            consumer, self.user_a.id, {"category": category.slug}
        )
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )

        questions = started["message"]["game_payload"]["questions"]
        for question in questions:
            user_a_payload = {
                "session_id": session_id,
                "question_id": question["id"],
                "text_answer": "Explore",
                "predicted_text_answer": "Relax",
            }
            user_b_payload = {
                "session_id": session_id,
                "question_id": question["id"],
                "text_answer": "Relax",
                "predicted_text_answer": "Explore",
            }
            update_a = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, user_a_payload)
            self.assertEqual(update_a["event"], "game_update")

        state_a = consumer._get_waiting_game_state.__wrapped__(consumer, self.user_a.id)
        state_b = consumer._get_waiting_game_state.__wrapped__(consumer, self.user_b.id)
        self.assertTrue(state_a["waiting_for_match"])
        self.assertEqual(len(state_a["answered_question_ids"]), 5)
        self.assertTrue(state_b["your_turn"])
        self.assertEqual(len(state_b["answered_question_ids"]), 0)
        self.assertFalse(
            Message.objects.filter(
                match=self.matched,
                game_payload__event_type__in=["game_round_result", "game_result"],
                game_payload__session_id=session_id,
            ).exists()
        )

        final_result = None
        for question in questions:
            payload = {
                "session_id": session_id,
                "question_id": question["id"],
                "text_answer": "Relax",
                "predicted_text_answer": "Explore",
            }
            final_result = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, payload)

        self.assertEqual(final_result["event"], "game_session_completed")
        result = final_result["data"]["result"]
        self.assertEqual(result["user_a_correct"], 5)
        self.assertEqual(result["user_b_correct"], 5)
        self.assertEqual(result["matched"], 10)
        self.assertEqual(len(result["questions"]), 5)
        self.assertTrue(all(item["user_a_correct"] and item["user_b_correct"] for item in result["questions"]))

    def test_guess_their_pick_rejects_missing_or_invalid_guess(self):
        category, _, _ = self._create_guess_their_pick()
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )
        question = started["message"]["game_payload"]["questions"][0]
        base_payload = {"session_id": session_id, "question_id": question["id"], "text_answer": "Explore"}
        with self.assertRaisesMessage(ValueError, "Choose your match's pick before submitting."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, base_payload)
        with self.assertRaisesMessage(ValueError, "Choose answers from the options shown."):
            consumer._handle_answer_question.__wrapped__(
                consumer, self.user_a.id, {**base_payload, "predicted_text_answer": "Not an option"}
            )

    def test_build_a_story_stays_private_until_both_finish_then_reveals_lines(self):
        category = GameCategory.objects.create(
            name="Build a Story", slug="build_a_story", emoji="📖", is_active=True
        )
        story_game = Game.objects.create(
            name="Build a Story", emoji="📖", description="Write together",
            type=Game.Type.TEXT, is_active=True,
        )
        for index in range(1, 6):
            GameQuestion.objects.create(
                game=story_game, category=category,
                game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=f"Story starter {index}", options=[], order=index, is_active=True,
            )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )
        questions = started["message"]["game_payload"]["questions"]
        for index, question in enumerate(questions, start=1):
            update = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": session_id, "question_id": question["id"],
                "story_text": f"A's line {index}",
            })
            self.assertEqual(update["event"], "game_update")
        self.assertTrue(consumer._get_waiting_game_state.__wrapped__(consumer, self.user_a.id)["waiting_for_match"])
        self.assertFalse(Message.objects.filter(
            match=self.matched,
            game_payload__event_type__in=["game_round_result", "game_result"],
            game_payload__session_id=session_id,
        ).exists())

        result = None
        for index, question in enumerate(questions, start=1):
            result = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id, "question_id": question["id"],
                "story_text": f"B's line {index}",
            })
        self.assertEqual(result["event"], "game_session_completed")
        self.assertEqual(result["data"]["result"]["summary"], "You made a story together 📖")
        self.assertEqual(len(result["data"]["result"]["questions"]), 5)
        self.assertEqual(result["data"]["result"]["questions"][0]["user_a"], "A's line 1")
        self.assertEqual(result["data"]["result"]["questions"][0]["user_b"], "B's line 1")
        self.assertEqual(GameSession.objects.get(id=session_id).status, GameSession.Status.COMPLETED)

    def test_build_a_story_rejects_empty_and_overlong_lines(self):
        category = GameCategory.objects.create(
            name="Build a Story", slug="build_a_story", emoji="📖", is_active=True
        )
        story_game = Game.objects.create(
            name="Build a Story", emoji="📖", type=Game.Type.TEXT, is_active=True,
        )
        for index in range(1, 6):
            GameQuestion.objects.create(
                game=story_game, category=category,
                game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=f"Starter {index}", options=[], order=index, is_active=True,
            )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": started["session_id"], "action": "accept"}
        )
        question_id = started["message"]["game_payload"]["questions"][0]["id"]
        with self.assertRaisesMessage(ValueError, "Add a story line before submitting."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": started["session_id"], "question_id": question_id, "story_text": "   ",
            })
        with self.assertRaisesMessage(ValueError, "Story lines must be 240 characters or fewer."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": started["session_id"], "question_id": question_id, "story_text": "x" * 241,
            })

    def _create_two_truths_and_lie(self):
        category = GameCategory.objects.create(
            name="Two Truths and a Lie", slug="two_truths_and_a_lie", emoji="🕵️", is_active=True
        )
        game = Game.objects.create(
            name="Two Truths and a Lie", emoji="🕵️", type=Game.Type.TEXT, is_active=True,
        )
        for index in range(1, 6):
            GameQuestion.objects.create(
                game=game, category=category,
                game_type=GameQuestion.GameType.OPEN_ENDED,
                question_text=f"Share three things about yourself {index}.",
                options=[], order=index, is_active=True,
            )
        return category

    def test_two_truths_and_lie_keeps_lie_private_until_both_guess(self):
        category = self._create_two_truths_and_lie()
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        session_id = started["session_id"]
        self.assertEqual(len(started["message"]["game_payload"]["questions"]), 1)
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )
        question_id = started["message"]["game_payload"]["questions"][0]["id"]
        statements_a = ["I have a hidden talent", "I once missed a flight", "I dislike all desserts"]
        statements_b = ["I can juggle", "I have been camping", "I have met a famous singer"]
        first = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
            "session_id": session_id, "question_id": question_id,
            "truth_statements": statements_a, "lie_index": 2,
        })
        self.assertEqual(first["event"], "game_update")
        self.assertIsNone(consumer._get_waiting_game_state.__wrapped__(consumer, self.user_a.id)["statement_sets"])
        self.assertFalse(Message.objects.filter(
            match=self.matched, game_payload__event_type__in=["game_round_result", "game_result"],
            game_payload__session_id=session_id,
        ).exists())

        second = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
            "session_id": session_id, "question_id": question_id,
            "truth_statements": statements_b, "lie_index": 0,
        })
        self.assertEqual(second["event"], "game_update")
        self.assertEqual(second["data"]["statement_sets"][str(self.user_a.id)], statements_a)
        self.assertEqual(second["data"]["statement_sets"][str(self.user_b.id)], statements_b)
        self.assertNotIn("lie_index", str(second["data"]["statement_sets"]))

        guess_a = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
            "session_id": session_id, "question_id": question_id, "guessed_lie_index": 0,
        })
        self.assertEqual(guess_a["event"], "game_update")
        self.assertFalse(Message.objects.filter(
            match=self.matched, game_payload__event_type="game_result",
            game_payload__session_id=session_id,
        ).exists())
        finished = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
            "session_id": session_id, "question_id": question_id, "guessed_lie_index": 0,
        })
        self.assertEqual(finished["event"], "game_session_completed")
        result = finished["data"]["result"]
        self.assertEqual(result["user_a_correct"], 1)
        self.assertEqual(result["user_b_correct"], 0)
        self.assertEqual(result["questions"][0]["user_a"]["lie_index"], 2)
        self.assertEqual(result["questions"][0]["user_b"]["lie_index"], 0)

    def test_two_truths_and_lie_rejects_bad_statements_and_guesses(self):
        category = self._create_two_truths_and_lie()
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": started["session_id"], "action": "accept"}
        )
        question_id = started["message"]["game_payload"]["questions"][0]["id"]
        base = {"session_id": started["session_id"], "question_id": question_id}
        with self.assertRaisesMessage(ValueError, "Enter exactly three statements."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                **base, "truth_statements": ["one", "two"], "lie_index": 1,
            })
        with self.assertRaisesMessage(ValueError, "Mark one of the three statements as the lie."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                **base, "truth_statements": ["one", "two", "three"], "lie_index": 3,
            })
        consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
            **base, "truth_statements": ["one", "two", "three"], "lie_index": 1,
        })
        with self.assertRaisesMessage(ValueError, "Your match's statements are not ready yet."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                **base, "guessed_lie_index": 0,
            })
        consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
            **base, "truth_statements": ["red", "blue", "green"], "lie_index": 2,
        })
        with self.assertRaisesMessage(ValueError, "Choose one of the three statements."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                **base, "guessed_lie_index": 3,
            })
        consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
            **base, "guessed_lie_index": 2,
        })
        with self.assertRaisesMessage(ValueError, "Your guess is already locked in."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                **base, "guessed_lie_index": 1,
            })

    def _create_choose_your_adventure(self):
        category = GameCategory.objects.create(
            name="Choose Your Adventure", slug="choose_your_adventure", emoji="🗺️", is_active=True
        )
        game = Game.objects.create(
            name="Choose Your Adventure", emoji="🗺️", type=Game.Type.CHOICE, is_active=True,
        )
        order = 0
        for adventure in ("moon", "forest"):
            for stage in range(1, 6):
                order += 1
                GameQuestion.objects.create(
                    game=game, category=category,
                    game_type=GameQuestion.GameType.THIS_OR_THAT,
                    question_text=f"{adventure} scene {stage}",
                    options=[
                        {"text": f"{adventure} bold {stage}", "path": "bold"},
                        {"text": f"{adventure} gentle {stage}", "path": "gentle"},
                    ],
                    tags=[adventure, f"stage-{stage}"], order=order, is_active=True,
                )
        return category

    def test_choose_adventure_keeps_a_coherent_path_and_reveals_after_both_finish(self):
        category = self._create_choose_your_adventure()
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        questions = started["message"]["game_payload"]["questions"]
        self.assertEqual(len(questions), 5)
        adventure_names = {item["question_text"].split()[0] for item in questions}
        self.assertEqual(len(adventure_names), 1)
        self.assertEqual([item["question_text"].split()[-1] for item in questions], [str(i) for i in range(1, 6)])
        session_id = started["session_id"]
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": session_id, "action": "accept"}
        )
        for question in questions:
            update = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": session_id,
                "question_id": question["id"],
                "text_answer": question["options"][0]["text"],
            })
            self.assertEqual(update["event"], "game_update")
        self.assertFalse(Message.objects.filter(
            match=self.matched, game_payload__event_type="game_result",
            game_payload__session_id=session_id,
        ).exists())
        result = None
        for question in questions:
            result = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, {
                "session_id": session_id,
                "question_id": question["id"],
                "text_answer": question["options"][1]["text"],
            })
        self.assertEqual(result["event"], "game_session_completed")
        adventure_result = result["data"]["result"]
        self.assertEqual(adventure_result["total"], 5)
        self.assertEqual(adventure_result["matched"], 0)
        self.assertIn("fearless trailblazer", adventure_result["user_a_ending"])
        self.assertIn("thoughtful wanderer", adventure_result["user_b_ending"])

    def test_choose_adventure_rejects_choices_outside_the_scene(self):
        category = self._create_choose_your_adventure()
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": category.slug})
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": started["session_id"], "action": "accept"}
        )
        question = started["message"]["game_payload"]["questions"][0]
        with self.assertRaisesMessage(ValueError, "Choose one of the adventure options shown."):
            consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
                "session_id": started["session_id"], "question_id": question["id"],
                "text_answer": "A different choice",
            })

    def test_new_game_request_replaces_an_unanswered_invite(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        first = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})
        second = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})

        old_session = GameSession.objects.get(id=first["session_id"])
        old_message = Message.objects.get(id=first["message"]["id"])
        self.assertEqual(old_session.status, GameSession.Status.EXPIRED)
        self.assertEqual(old_message.game_payload["invite_status"], "replaced")
        self.assertIn("replaced", old_message.content)
        self.assertEqual(second["closed_invites"][0]["session_id"], first["session_id"])
        self.assertEqual(GameSession.objects.get(id=second["session_id"]).status, GameSession.Status.INVITED)
        self.assertEqual(Message.objects.filter(match=self.matched, message_type=Message.MessageType.GAME_EVENT).count(), 2)

    def test_new_game_request_replaces_an_accepted_but_unstarted_game(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        first = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": first["session_id"], "action": "accept"}
        )
        second = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})

        old_session = GameSession.objects.get(id=first["session_id"])
        old_message = Message.objects.get(id=first["message"]["id"])
        self.assertEqual(old_session.status, GameSession.Status.EXPIRED)
        self.assertEqual(old_message.game_payload["invite_status"], "replaced")
        self.assertIn(first["session_id"], [item["session_id"] for item in second["closed_invites"]])

    def test_new_game_request_replaces_a_partially_played_game(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})
        consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": started["session_id"], "action": "accept"}
        )
        question = started["message"]["game_payload"]["questions"][0]
        consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, {
            "session_id": started["session_id"],
            "question_id": question["id"],
            "selected_option": question["options"][0]["text"],
            "text_answer": question["options"][0]["text"],
        })

        replacement = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})
        old_session = GameSession.objects.get(id=started["session_id"])
        old_message = Message.objects.get(id=started["message"]["id"])
        self.assertEqual(old_session.status, GameSession.Status.EXPIRED)
        self.assertEqual(old_message.game_payload["invite_status"], "replaced")
        self.assertIn(started["session_id"], [item["session_id"] for item in replacement["closed_invites"]])
        self.assertEqual(GameSession.objects.get(id=replacement["session_id"]).status, GameSession.Status.INVITED)

    def test_game_invite_decline_closes_session(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})
        declined = consumer._handle_game_invite_response.__wrapped__(
            consumer, self.user_b.id, {"session_id": started["session_id"], "action": "decline"}
        )
        self.assertEqual(declined["event"], "game_invite_updated")
        self.assertEqual(declined["data"]["invite_status"], "declined")
        session = GameSession.objects.get(id=started["session_id"])
        self.assertEqual(session.status, GameSession.Status.DECLINED)

    def test_old_game_invite_expires_and_updates_chat_message(self):
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        started = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "this_or_that"})
        GameSession.objects.filter(id=started["session_id"]).update(created_at=timezone.now() - timedelta(days=8))

        expired_messages = consumer._expire_old_game_invites.__wrapped__(consumer, self.user_a.id)

        session = GameSession.objects.get(id=started["session_id"])
        invite = Message.objects.get(id=started["message"]["id"])
        self.assertEqual(session.status, GameSession.Status.EXPIRED)
        self.assertEqual(invite.game_payload["invite_status"], "expired")
        self.assertEqual(expired_messages[0].id, invite.id)

    def test_dots_and_boxes_turns_sync_and_finish_on_both_clients(self):
        category = GameCategory.objects.create(name="Dots and Boxes", slug="dots_and_boxes", emoji="🔲", is_active=True)
        game = Game.objects.create(name="Dots and Boxes", emoji="🔲", description="Claim boxes", type=Game.Type.CHOICE, is_active=True)
        GameQuestion.objects.create(
            game=game, category=category, game_type=GameQuestion.GameType.THIS_OR_THAT,
            question_text="Connect the dots", options=[], order=1, is_active=True,
        )
        consumer = ChatConsumer()
        consumer.match_id = self.matched.id
        invite = consumer._handle_start_game.__wrapped__(consumer, self.user_a.id, {"category": "dots_and_boxes"})
        consumer._handle_game_invite_response.__wrapped__(consumer, self.user_b.id, {"session_id": invite["session_id"], "action": "accept"})
        session_id = invite["session_id"]
        session = GameSession.objects.get(id=session_id)

        first_state = consumer._get_board_game_state.__wrapped__(consumer, self.user_a.id, {"session_id": session_id}, "dots_boxes_state_request")
        self.assertTrue(first_state["your_turn"])
        consumer._handle_dots_boxes_move.__wrapped__(consumer, self.user_a.id, {"session_id": session_id, "orientation": "horizontal", "row": 0, "col": 0})
        rejoined_state = consumer._get_board_game_state.__wrapped__(consumer, self.user_b.id, {"session_id": session_id}, "dots_boxes_state_request")
        self.assertEqual(rejoined_state["dots_boxes_state"]["horizontal"][0][0], "X")
        self.assertTrue(rejoined_state["your_turn"])

        for _ in range(23):
            session.refresh_from_db()
            state = session.game_state
            turn_user_id = int(state["turn_user_id"])
            move = next((("horizontal", row, col) for row, line in enumerate(state["horizontal"]) for col, mark in enumerate(line) if mark is None), None)
            if move is None:
                move = next(("vertical", row, col) for row, line in enumerate(state["vertical"]) for col, mark in enumerate(line) if mark is None)
            orientation, row, col = move
            consumer._handle_dots_boxes_move.__wrapped__(consumer, turn_user_id, {"session_id": session_id, "orientation": orientation, "row": row, "col": col})

        session.refresh_from_db()
        final_state = consumer._get_board_game_state.__wrapped__(consumer, self.user_a.id, {"session_id": session_id}, "dots_boxes_state_request")
        self.assertEqual(session.status, GameSession.Status.COMPLETED)
        self.assertTrue(final_state["dots_boxes_state"]["completed"])
