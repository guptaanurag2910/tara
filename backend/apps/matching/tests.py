from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.chat.models import Message
from apps.notifications.models import Notification

from .models import DailyRecommendation, Match, Swipe
from .swipe_service import handle_swipe

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


class RecommendationVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = create_user(
            email="arjun@example.com",
            name="Arjun",
            phone_number="+919100000001",
            gender="male",
            preference="female",
        )
        self.user_b = create_user(
            email="anaya@example.com",
            name="Anaya",
            phone_number="+919100000002",
            gender="female",
            preference="male",
        )
        self.match = Match.objects.create(
            user_a=self.user_a,
            user_b=self.user_b,
            kundali_score=30,
            personality_score=80,
            final_score=91,
            match_type="Cosmic Match",
            insight_text="Strong potential.",
            status=Match.Status.LIKED,
            is_visible=True,
        )

    @patch("apps.matching.views.get_recommendations_for_user")
    def test_user_who_has_not_swiped_still_sees_liked_candidate(self, mock_recommendations):
        mock_recommendations.return_value = []
        self.client.force_authenticate(self.user_b)

        response = self.client.get("/api/recommendations/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["user_id"], self.user_a.id)
        self.assertEqual(payload["results"][0]["name"], self.user_a.name)


class MutualLikeFlowTests(TestCase):
    def setUp(self):
        self.user_a = create_user(
            email="kabir@example.com",
            name="Kabir",
            phone_number="+919100000003",
            gender="male",
            preference="female",
        )
        self.user_b = create_user(
            email="riya@example.com",
            name="Riya",
            phone_number="+919100000004",
            gender="female",
            preference="male",
        )
        self.match = Match.objects.create(
            user_a=self.user_a,
            user_b=self.user_b,
            kundali_score=24,
            personality_score=70,
            final_score=75,
            match_type="Cosmic Match",
            insight_text="Aligned.",
            status=Match.Status.SUGGESTED,
            is_visible=True,
        )

    def test_mutual_like_creates_match_notifications_and_chat_bootstrap(self):
        first_like = handle_swipe(self.user_a, self.user_b, Swipe.Action.LIKE)
        self.assertFalse(first_like["is_match"])

        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.LIKED)

        second_like = handle_swipe(self.user_b, self.user_a, Swipe.Action.LIKE)
        self.assertTrue(second_like["is_match"])

        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.MATCHED)
        self.assertIsNotNone(self.match.matched_at)

        self.assertEqual(
            Swipe.objects.filter(user=self.user_a, target_user=self.user_b, action=Swipe.Action.LIKE).count(),
            1,
        )
        self.assertEqual(
            Swipe.objects.filter(user=self.user_b, target_user=self.user_a, action=Swipe.Action.LIKE).count(),
            1,
        )

        self.assertEqual(Notification.objects.filter(user=self.user_a, type=Notification.Type.MATCH).count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.user_b, type=Notification.Type.MATCH).count(), 1)

        bootstrap_messages = Message.objects.filter(
            match=self.match,
            message_type=Message.MessageType.GAME_EVENT,
        )
        self.assertEqual(bootstrap_messages.count(), 1)
        self.assertEqual(bootstrap_messages.first().content, "It's a match! Start the conversation ✨")


class DailyRecommendationFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = create_user(
            email="daily-a@example.com",
            name="Daily A",
            phone_number="+919100000011",
            gender="male",
            preference="female",
        )
        self.user_b = create_user(
            email="daily-b@example.com",
            name="Daily B",
            phone_number="+919100000012",
            gender="female",
            preference="male",
        )
        self.user_c = create_user(
            email="daily-c@example.com",
            name="Daily C",
            phone_number="+919100000013",
            gender="female",
            preference="male",
        )

    def _create_match(self, user_one, user_two, *, final_score, insight_text):
        user_a, user_b = (user_one, user_two) if user_one.id < user_two.id else (user_two, user_one)
        return Match.objects.create(
            user_a=user_a,
            user_b=user_b,
            kundali_score=28,
            personality_score=74,
            final_score=final_score,
            match_type="Cosmic Match",
            insight_text=insight_text,
            status=Match.Status.SUGGESTED,
            is_visible=True,
        )

    def test_daily_recommendation_endpoint_returns_user_specific_rows(self):
        self._create_match(self.user_a, self.user_b, final_score=88, insight_text="A and B are aligned.")
        self._create_match(self.user_b, self.user_c, final_score=79, insight_text="B and C feel fresh.")
        DailyRecommendation.objects.create(user=self.user_a, recommended_user=self.user_b, score=88)
        DailyRecommendation.objects.create(user=self.user_b, recommended_user=self.user_c, score=79)

        self.client.force_authenticate(self.user_a)
        response_a = self.client.get("/api/daily-recommendations/")
        self.assertEqual(response_a.status_code, 200)
        payload_a = response_a.json()
        self.assertEqual(payload_a["count"], 1)
        self.assertEqual(payload_a["results"][0]["user_id"], self.user_b.id)
        self.assertEqual(payload_a["results"][0]["name"], self.user_b.name)
        self.assertEqual(payload_a["results"][0]["insight"], "A and B are aligned.")

        self.client.force_authenticate(self.user_b)
        response_b = self.client.get("/api/daily-recommendations/")
        self.assertEqual(response_b.status_code, 200)
        payload_b = response_b.json()
        self.assertEqual(payload_b["count"], 1)
        self.assertEqual(payload_b["results"][0]["user_id"], self.user_c.id)
        self.assertEqual(payload_b["results"][0]["name"], self.user_c.name)
        self.assertEqual(payload_b["results"][0]["insight"], "B and C feel fresh.")

    @patch("apps.matching.recommendation_service.notify_daily_recommendation")
    @patch("apps.matching.recommendation_service.get_recommendations_for_user")
    def test_repeated_daily_recommendation_requests_reuse_same_day_rows(
        self,
        mock_get_recommendations,
        mock_notify_daily_recommendation,
    ):
        self._create_match(self.user_a, self.user_b, final_score=86, insight_text="Repeat-safe daily row.")
        mock_get_recommendations.return_value = [
            {
                "user_id": self.user_b.id,
                "name": self.user_b.name,
                "compatibility_score": 86,
                "kundali_score": 28,
                "personality_score": 74,
                "insight": "Repeat-safe daily row.",
            }
        ]

        self.client.force_authenticate(self.user_a)
        first_response = self.client.get("/api/daily-recommendations/")
        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(DailyRecommendation.objects.filter(user=self.user_a).count(), 1)

        second_response = self.client.get("/api/daily-recommendations/")
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(DailyRecommendation.objects.filter(user=self.user_a).count(), 1)
        self.assertEqual(mock_get_recommendations.call_count, 1)
        self.assertEqual(mock_notify_daily_recommendation.call_count, 1)
