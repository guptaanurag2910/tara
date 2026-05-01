from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.matching.models import Match

from .models import Game, GameCategory, GameQuestion, GameResponse, GameSession, GameSessionQuestion
from .services import fetch_next_question

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


class StartGameSessionNegativeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = create_user(
            email="games-a@example.com",
            name="Games A",
            phone_number="+919300000001",
            gender="male",
            preference="female",
        )
        self.user_b = create_user(
            email="games-b@example.com",
            name="Games B",
            phone_number="+919300000002",
            gender="female",
            preference="male",
        )
        self.outsider = create_user(
            email="games-c@example.com",
            name="Games C",
            phone_number="+919300000003",
            gender="female",
            preference="male",
        )

        self.matched = Match.objects.create(
            user_a=self.user_a,
            user_b=self.user_b,
            kundali_score=30,
            personality_score=82,
            final_score=90,
            match_type="Cosmic Match",
            insight_text="Great alignment.",
            status=Match.Status.MATCHED,
            is_visible=True,
        )
        self.suggested = Match.objects.create(
            user_a=self.user_a,
            user_b=self.outsider,
            kundali_score=20,
            personality_score=64,
            final_score=61,
            match_type="Cosmic Match",
            insight_text="Not matched yet.",
            status=Match.Status.SUGGESTED,
            is_visible=True,
        )

        self.category = GameCategory.objects.create(
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
        for index, question_text in enumerate(
            ["Dogs or cats?", "Tea or coffee?", "Beach or mountains?"],
            start=1,
        ):
            GameQuestion.objects.create(
                game=self.game,
                category=self.category,
                game_type=GameQuestion.GameType.THIS_OR_THAT,
                question_text=question_text,
                options=[{"text": "Left"}, {"text": "Right"}],
                order=index,
                is_active=True,
            )

    def test_start_game_rejects_unknown_match(self):
        self.client.force_authenticate(self.user_a)

        response = self.client.post(
            "/api/games/start/",
            {"match_id": 999999, "category": "this_or_that"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["match_id"], "Match not found.")

    def test_start_game_rejects_non_matched_chat(self):
        self.client.force_authenticate(self.user_a)

        response = self.client.post(
            "/api/games/start/",
            {"match_id": self.suggested.id, "category": "this_or_that"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Game can only start for matched users.")

    def test_start_game_rejects_user_outside_match(self):
        self.client.force_authenticate(self.outsider)

        response = self.client.post(
            "/api/games/start/",
            {"match_id": self.matched.id, "category": "this_or_that"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "You are not part of this match.")


class GameSessionIntegrityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = create_user(
            email="games-integrity-a@example.com",
            name="Games Integrity A",
            phone_number="+919300000011",
            gender="male",
            preference="female",
        )
        self.user_b = create_user(
            email="games-integrity-b@example.com",
            name="Games Integrity B",
            phone_number="+919300000012",
            gender="female",
            preference="male",
        )
        self.matched = Match.objects.create(
            user_a=self.user_a,
            user_b=self.user_b,
            kundali_score=30,
            personality_score=82,
            final_score=90,
            match_type="Cosmic Match",
            insight_text="Great alignment.",
            status=Match.Status.MATCHED,
            is_visible=True,
        )
        self.category = GameCategory.objects.create(
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
                category=self.category,
                game_type=GameQuestion.GameType.THIS_OR_THAT,
                question_text=question_text,
                options=[{"text": "Left"}, {"text": "Right"}],
                order=index,
                is_active=True,
            )
            for index, question_text in enumerate(
                ["Dogs or cats?", "Tea or coffee?", "Beach or mountains?"],
                start=1,
            )
        ]

    def test_start_game_persists_session_questions(self):
        self.client.force_authenticate(self.user_a)

        response = self.client.post(
            "/api/games/start/",
            {"match_id": self.matched.id, "category": "this_or_that"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        session_id = response.data["session_id"]
        returned_ids = [question["id"] for question in response.data["questions"]]
        persisted_ids = list(
            GameSessionQuestion.objects.filter(session_id=session_id)
            .order_by("order", "id")
            .values_list("question_id", flat=True)
        )
        self.assertEqual(len(persisted_ids), 3)
        self.assertEqual(returned_ids, persisted_ids)

    def test_start_game_reuses_existing_session_question_set(self):
        self.client.force_authenticate(self.user_a)

        first = self.client.post(
            "/api/games/start/",
            {"match_id": self.matched.id, "category": "this_or_that"},
            format="json",
        )
        second = self.client.post(
            "/api/games/start/",
            {"match_id": self.matched.id, "category": "this_or_that"},
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data["session_id"], second.data["session_id"])
        self.assertEqual(first.data["questions"], second.data["questions"])
        self.assertEqual(
            GameSession.objects.filter(match=self.matched, game=self.game, status=GameSession.Status.ACTIVE).count(),
            1,
        )
        self.assertEqual(GameSessionQuestion.objects.filter(session_id=first.data["session_id"]).count(), 3)

    def test_fetch_next_question_backfills_missing_session_questions(self):
        session = GameSession.objects.create(
            match=self.matched,
            category=self.category,
            game=self.game,
            created_by=self.user_a,
            started_by=self.user_a,
            current_question_index=1,
            status=GameSession.Status.ACTIVE,
        )
        first_question = self.questions[0]
        GameResponse.objects.create(session=session, user=self.user_a, question=first_question, text_answer="Left")
        GameResponse.objects.create(session=session, user=self.user_b, question=first_question, text_answer="Left")

        payload = fetch_next_question(session_id=session.id)

        persisted_ids = list(
            GameSessionQuestion.objects.filter(session_id=session.id)
            .order_by("order", "id")
            .values_list("question_id", flat=True)
        )
        self.assertEqual(len(persisted_ids), 3)
        self.assertEqual(persisted_ids[0], first_question.id)
        self.assertEqual(payload["question_id"], persisted_ids[1])
