from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test import SimpleTestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from apps.matching.models import Match

from .models import Game, GameCategory, GameQuestion, GameResponse, GameSession, GameSessionQuestion
from .services import fetch_next_question
from .snakes_ladders import apply_action, create_initial_state, serialize_state
from .spot_the_difference import (
    apply_action as apply_spot_action,
    create_initial_state as create_spot_state,
    serialize_state as serialize_spot_state,
)
from .memory_match import (
    apply_action as apply_memory_action,
    create_initial_state as create_memory_state,
    serialize_state as serialize_memory_state,
)

User = get_user_model()


class SnakesLaddersRulesTests(SimpleTestCase):
    def setUp(self):
        self.state = create_initial_state(101, 202, 101, [
            {"prompt": "Pick one", "options": ["Tea", "Coffee"]},
        ])

    def test_board_has_seven_by_seven_and_roll_climbs_ladder(self):
        self.assertEqual(self.state["board_size"], 7)
        with patch("apps.games.snakes_ladders.random.randint", return_value=3):
            updated = apply_action(self.state, 101, "roll", {})
        self.assertEqual(updated["positions"]["101"], 12)
        self.assertEqual(updated["turn_user_id"], 202)

    def test_route_choice_is_only_available_to_the_moving_player(self):
        self.state["positions"]["101"] = 8
        with patch("apps.games.snakes_ladders.random.randint", return_value=1):
            waiting = apply_action(self.state, 101, "roll", {})
        self.assertEqual(waiting["phase"], "route_choice")
        with self.assertRaisesMessage(ValueError, "There is no route choice waiting for you."):
            apply_action(waiting, 202, "choose_route", {"route": "steady"})
        steady = apply_action(waiting, 101, "choose_route", {"route": "steady"})
        self.assertEqual(steady["turn_user_id"], 202)

    def test_secret_pick_is_hidden_until_both_submit_then_revealed(self):
        self.state["positions"]["101"] = 5
        with patch("apps.games.snakes_ladders.random.randint", return_value=1):
            state = apply_action(self.state, 101, "roll", {})
        state = apply_action(state, 101, "answer_challenge", {"pick": "Tea", "prediction": "Coffee"})
        public = serialize_state(state)
        own = serialize_state(state, 101)
        self.assertNotIn("picks", public["challenge"])
        self.assertNotIn("own_pick", public["challenge"])
        self.assertEqual(own["challenge"]["own_pick"], "Tea")
        state = apply_action(state, 202, "answer_challenge", {"pick": "Coffee", "prediction": "Tea"})
        self.assertEqual(state["challenge"]["reveal"]["picks"], {"101": "Tea", "202": "Coffee"})
        self.assertTrue(state["challenge"]["reveal"]["correct"]["101"])

    def test_snake_slides_back_but_shield_blocks_it(self):
        self.state["positions"]["101"] = 13
        with patch("apps.games.snakes_ladders.random.randint", return_value=1):
            slid = apply_action(self.state, 101, "roll", {})
        self.assertEqual(slid["positions"]["101"], 5)

        self.state["shields"]["101"] = True
        with patch("apps.games.snakes_ladders.random.randint", return_value=1):
            blocked = apply_action(self.state, 101, "roll", {})
        self.assertEqual(blocked["positions"]["101"], 14)
        self.assertNotIn("101", blocked["shields"])

    def test_bonus_square_keeps_the_turn_and_swap_power_moves_both_players(self):
        self.state["positions"]["101"] = 22
        with patch("apps.games.snakes_ladders.random.randint", return_value=1):
            bonus = apply_action(self.state, 101, "roll", {})
        self.assertEqual(bonus["phase"], "roll")
        self.assertEqual(bonus["turn_user_id"], 101)

        self.state["positions"].update({"101": 35, "202": 8})
        with patch("apps.games.snakes_ladders.random.randint", return_value=1):
            swapped = apply_action(self.state, 101, "roll", {})
        self.assertEqual(swapped["positions"], {"101": 8, "202": 36})

    def test_first_player_to_finish_completes_the_game(self):
        self.state["positions"]["101"] = 48
        with patch("apps.games.snakes_ladders.random.randint", return_value=6):
            completed = apply_action(self.state, 101, "roll", {})
        self.assertTrue(completed["completed"])
        self.assertEqual(completed["winner_user_id"], 101)
        self.assertEqual(completed["positions"]["101"], 49)


class SpotTheDifferenceRulesTests(SimpleTestCase):
    def setUp(self):
        self.scene = {
            "scene_id": "test_scene",
            "title": "Test scene",
            "differences": [
                {"id": f"difference_{index}", "x": 100 + index * 120, "y": 200, "radius": 20,
                 "label": f"Difference {index + 1}"}
                for index in range(6)
            ],
        }
        self.state = create_spot_state(101, 202, 101, self.scene)

    def test_correct_find_scores_and_passes_turn_but_a_miss_also_passes_turn(self):
        miss = apply_spot_action(self.state, 101, "spot", {"x": 0, "y": 0})
        self.assertEqual(miss["turn_user_id"], 202)
        self.assertFalse(miss["last_attempt"]["correct"])
        found = apply_spot_action(miss, 202, "spot", {"x": 100, "y": 200})
        self.assertEqual(found["scores"]["202"], 1)
        self.assertEqual(found["found"], ["difference_0"])
        self.assertEqual(found["turn_user_id"], 101)

    def test_invalid_turn_and_out_of_board_coordinates_are_rejected(self):
        with self.assertRaisesMessage(ValueError, "It is your match's turn"):
            apply_spot_action(self.state, 202, "spot", {"x": 100, "y": 200})
        with self.assertRaisesMessage(ValueError, "outside the picture"):
            apply_spot_action(self.state, 101, "spot", {"x": 1001, "y": 200})

    def test_all_differences_can_finish_in_a_tie_and_reconnect_state_hides_unfound_locations(self):
        state = self.state
        first_snapshot = serialize_spot_state(state)
        self.assertNotIn("differences", first_snapshot)
        self.assertEqual(first_snapshot["difference_count"], 6)
        for index, difference in enumerate(self.scene["differences"]):
            active_user = int(state["turn_user_id"])
            state = apply_spot_action(state, active_user, "spot", {"x": difference["x"], "y": difference["y"]})
        self.assertTrue(state["completed"])
        self.assertTrue(state["draw"])
        self.assertIsNone(state["turn_user_id"])
        self.assertEqual(len(serialize_spot_state(state)["differences"]), 6)


class MemoryMatchRulesTests(SimpleTestCase):
    def setUp(self):
        self.deck = {"title": "Test deck", "cards": [
            {"id": "a", "face": "🍎"}, {"id": "b", "face": "🍋"},
            {"id": "c", "face": "🍇"}, {"id": "d", "face": "🍒"},
        ]}
        with patch("apps.games.memory_match.random.shuffle", side_effect=lambda cards: cards.reverse()):
            self.state = create_memory_state(101, 202, 101, self.deck)

    def test_mismatch_passes_turn_and_keeps_cards_revealed_until_opponent_starts(self):
        faces = {}
        for card in self.state["cards"]:
            faces.setdefault(card["face"], []).append(card["id"])
        first_id, second_id = faces["🍎"][0], faces["🍋"][0]
        state = apply_memory_action(self.state, 101, "flip", {"card_id": first_id})
        state = apply_memory_action(state, 101, "flip", {"card_id": second_id})
        self.assertEqual(state["phase"], "next_turn")
        self.assertEqual(state["turn_user_id"], 202)
        opponent_view = serialize_memory_state(state)
        self.assertTrue(all(card["revealed"] for card in opponent_view["cards"] if card["id"] in [first_id, second_id]))
        next_card = next(card for card in state["cards"] if card["id"] not in [first_id, second_id])
        state = apply_memory_action(state, 202, "flip", {"card_id": next_card["id"]})
        self.assertEqual(state["phase"], "second")
        self.assertEqual(state["face_up"], [next_card["id"]])

    def test_invalid_turn_and_duplicate_flip_are_rejected(self):
        first = self.state["cards"][0]["id"]
        with self.assertRaisesMessage(ValueError, "It is your match's turn"):
            apply_memory_action(self.state, 202, "flip", {"card_id": first})
        one_card = apply_memory_action(self.state, 101, "flip", {"card_id": first})
        with self.assertRaisesMessage(ValueError, "already revealed"):
            apply_memory_action(one_card, 101, "flip", {"card_id": first})

    def test_complete_board_reports_win_or_tie_and_reveals_all_cards(self):
        faces = {}
        for card in self.state["cards"]:
            faces.setdefault(card["face"], []).append(card["id"])
        state = self.state
        for index, ids in enumerate(faces.values()):
            active_user = 101 if index % 2 == 0 else 202
            state["turn_user_id"] = active_user
            state = apply_memory_action(state, active_user, "flip", {"card_id": ids[0]})
            state = apply_memory_action(state, active_user, "flip", {"card_id": ids[1]})
        self.assertTrue(state["completed"])
        self.assertTrue(state["draw"])
        self.assertIsNone(state["turn_user_id"])
        self.assertTrue(all(card["revealed"] for card in serialize_memory_state(state)["cards"]))


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

    def test_start_game_does_not_pad_the_selected_question_set(self):
        for index in range(4, 8):
            GameQuestion.objects.create(
                game=self.game,
                category=self.category,
                game_type=GameQuestion.GameType.THIS_OR_THAT,
                question_text=f"Extra choice {index}?",
                options=[{"text": "Left"}, {"text": "Right"}],
                order=index,
                is_active=True,
            )
        self.client.force_authenticate(self.user_a)

        response = self.client.post(
            "/api/games/start/",
            {"match_id": self.matched.id, "category": "this_or_that"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["questions"]), 3)
        self.assertEqual(
            GameSessionQuestion.objects.filter(session_id=response.data["session_id"]).count(),
            3,
        )

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
