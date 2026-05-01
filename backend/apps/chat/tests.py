from datetime import date
from decimal import Decimal
from unittest.mock import patch

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.games.models import Game, GameCategory, GameQuestion, GameSession, GameSessionQuestion, GameResponse
from apps.matching.models import Match

from .consumers import ChatConsumer
from .models import Message

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
                ],
                start=1,
            )
        ]

    def test_matched_chat_history_loads_for_participants(self):
        Message.objects.create(
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
        self.assertEqual(len(start_result["questions"]), 3)
        session_id = start_result["session_id"]

        session = GameSession.objects.get(id=session_id)
        self.assertEqual(session.status, GameSession.Status.ACTIVE)
        self.assertEqual(session.category_id, self.game_category.id)
        self.assertEqual(GameSessionQuestion.objects.filter(session=session).count(), 3)

        for question in start_result["questions"]:
            payload = {
                "session_id": session_id,
                "question_id": question["id"],
                "selected_option": question["options"][0]["text"],
                "text_answer": question["options"][0]["text"],
            }
            update_a = consumer._handle_answer_question.__wrapped__(consumer, self.user_a.id, payload)
            self.assertEqual(update_a["event"], "game_update")
            update_b = consumer._handle_answer_question.__wrapped__(consumer, self.user_b.id, payload)

        self.assertEqual(update_b["event"], "game_result")
        self.assertTrue(update_b["data"]["completed"])
        self.assertEqual(update_b["data"]["category"], "this_or_that")
        self.assertEqual(update_b["data"]["result"]["matched"], 3)
        self.assertEqual(update_b["data"]["result"]["summary"], "Cosmic sync. Three for three.")

        session.refresh_from_db()
        self.assertEqual(session.status, GameSession.Status.COMPLETED)
        self.assertEqual(GameResponse.objects.filter(session=session).count(), 6)

        result_message = Message.objects.filter(
            match=self.matched,
            message_type=Message.MessageType.GAME_EVENT,
            game_payload__event_type="game_result",
        ).latest("id")
        self.assertEqual(result_message.game_payload["category"], "this_or_that")
        self.assertEqual(result_message.content, "Cosmic sync. Three for three.")
