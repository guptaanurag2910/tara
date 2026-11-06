from datetime import date, datetime, timedelta, timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.chat.models import Message

from .game_night import schedule_snapshot
from .models import GameNightEntry, GameNightReport, GameNightSession, GameNightWindow, Match, Swipe


def make_user(number, gender, preference, *, staff=False):
    User = get_user_model()
    return User.objects.create_user(
        email=f"game{number}@example.com", password="TaraDemo@123", name=f"Player {number}",
        phone_number=f"+91990000{number:04d}", date_of_birth=date(1995, 1, 1),
        gender=gender, preference=preference,
        latitude=Decimal("12.971600"), longitude=Decimal("77.594600"),
        is_staff=staff,
    )


class GameNightTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.a = make_user(1, "male", "female")
        self.b = make_user(2, "female", "male")
        self.c = make_user(3, "male", "female")
        self.open_time = datetime(2026, 10, 28, 15, 0, tzinfo=dt_timezone.utc)

    def test_default_schedule_and_closed_join(self):
        self.assertEqual(GameNightWindow.objects.count(), 7)
        self.assertEqual(set(GameNightWindow.objects.values_list("weekday", flat=True)), set(range(7)))
        self.assertTrue(all(
            window.start_time.hour == 19 and window.end_time.hour == 22
            for window in GameNightWindow.objects.all()
        ))
        self.client.force_authenticate(self.a)
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time - timedelta(hours=3)):
            response = self.client.post("/api/matching/game-night/queue/")
            self.assertEqual(response.status_code, 400)
            self.assertFalse(schedule_snapshot()["is_open"])

    def test_waiting_queue_reconnect_and_expired_room_cleanup(self):
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time):
            self.client.force_authenticate(self.c)
            self.assertEqual(self.client.post("/api/matching/game-night/queue/").json()["state"], "waiting")
            self.assertEqual(self.client.delete("/api/matching/game-night/queue/").json()["state"], "idle")
            self.assertEqual(self.client.get("/api/matching/game-night/queue/").json()["state"], "idle")

            self.client.force_authenticate(self.a)
            first_join = self.client.post("/api/matching/game-night/queue/").json()
            self.assertEqual(first_join["state"], "waiting")
            self.assertEqual(self.client.get("/api/matching/game-night/queue/").json()["state"], "waiting")

            self.client.force_authenticate(self.b)
            paired = self.client.post("/api/matching/game-night/queue/").json()
            self.assertEqual(paired["state"], "room")

            # A client that reconnects after the other player pairs must resume the same room.
            self.client.force_authenticate(self.a)
            resumed = self.client.get("/api/matching/game-night/queue/").json()
            self.assertEqual(resumed["state"], "room")
            self.assertEqual(resumed["id"], paired["id"])

            # Expiry is surfaced to both clients and the user can clear the closed room.
            GameNightSession.objects.filter(pk=paired["id"]).update(expires_at=self.open_time - timedelta(seconds=1))
            expired = self.client.get("/api/matching/game-night/queue/").json()
            self.assertEqual(expired["state"], "room")
            self.assertEqual(expired["status"], GameNightSession.Status.EXPIRED)
            self.assertEqual(self.client.delete("/api/matching/game-night/queue/").status_code, 200)
            self.assertEqual(self.client.get("/api/matching/game-night/queue/").json()["state"], "idle")

    @patch("apps.matching.game_night._choose_game", return_value="forbidden_word")
    def test_pair_game_private_choice_and_chat(self, _):
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time):
            self.client.force_authenticate(self.a)
            self.assertEqual(self.client.post("/api/matching/game-night/queue/").json()["state"], "waiting")
            self.client.force_authenticate(self.b)
            joined = self.client.post("/api/matching/game-night/queue/").json()
            self.assertEqual(joined["state"], "room")
            self.assertEqual(joined["game_kind"], "forbidden_word")
            self.assertIn("secret", joined["game"]["card"])
            room_id = joined["id"]
            self.assertEqual(self.client.post(f"/api/matching/game-night/rooms/{room_id}/action/", {
                "content": joined["game"]["card"]["secret"]
            }).status_code, 400)
            self.client.force_authenticate(self.c)
            self.assertEqual(self.client.get(f"/api/matching/game-night/rooms/{room_id}/").status_code, 403)
            self.client.force_authenticate(self.a)
            room = self.client.get("/api/matching/game-night/queue/").json()
            self.assertNotIn("secret", room["game"]["card"])
            self.assertEqual(self.client.post(f"/api/matching/game-night/rooms/{room_id}/messages/", {"content": "Hello!"}).status_code, 200)
            self.assertEqual(self.client.post(f"/api/matching/game-night/rooms/{room_id}/vote/", {"choice": "match"}).status_code, 400)
            GameNightSession.objects.filter(pk=room_id).update(play_ends_at=self.open_time - timedelta(seconds=1))
            first_vote = self.client.post(f"/api/matching/game-night/rooms/{room_id}/vote/", {"choice": "match"}).json()
            self.assertEqual(first_vote["status"], "active")
            self.assertEqual(first_vote["your_vote"], "match")
            self.assertIsNone(first_vote["match_id"])
            self.client.force_authenticate(self.b)
            self.assertEqual(self.client.get(f"/api/matching/game-night/rooms/{room_id}/").json()["your_vote"], "")
            second_vote = self.client.post(f"/api/matching/game-night/rooms/{room_id}/vote/", {"choice": "match"}).json()
            self.assertEqual(second_vote["status"], "matched")
            self.assertTrue(second_vote["match_id"])
            self.assertEqual(Match.objects.filter(status=Match.Status.MATCHED).count(), 1)
            self.assertEqual(GameNightSession.objects.get(pk=room_id).messages.count(), 1)
            memory = Message.objects.get(match_id=second_vote["match_id"], game_payload__event_type="game_night_memory")
            self.assertEqual(memory.game_payload["game_name"], "Forbidden Word")
            self.assertIn("prompt", memory.game_payload)
            self.assertTrue(Message.objects.filter(match_id=second_vote["match_id"], content="Hello!").exists())
            prompts = self.client.get(f"/api/matches/{second_vote['match_id']}/icebreakers/").json()["suggestions"]
            self.assertTrue(any("word game" in prompt for prompt in prompts))

    @patch("apps.matching.game_night._choose_game", return_value="plot_twist")
    def test_pass_ends_room_without_match_and_allows_dismissal(self, _):
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time):
            self.client.force_authenticate(self.a)
            self.client.post("/api/matching/game-night/queue/")
            self.client.force_authenticate(self.b)
            room_id = self.client.post("/api/matching/game-night/queue/").json()["id"]
            result = self.client.post(f"/api/matching/game-night/rooms/{room_id}/vote/", {"choice": "pass"}).json()
            self.assertEqual(result["status"], "passed")
            self.assertFalse(Match.objects.filter(status=Match.Status.MATCHED).exists())
            self.client.force_authenticate(self.a)
            self.assertEqual(self.client.get("/api/matching/game-night/queue/").json()["status"], "passed")
            self.assertEqual(self.client.delete("/api/matching/game-night/queue/").status_code, 200)
            self.assertIsNone(GameNightEntry.objects.get(user=self.a).session_id)

    @patch("apps.matching.game_night._choose_game", return_value="plot_twist")
    def test_report_is_participant_only_idempotent_and_closes_room(self, _):
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time):
            self.client.force_authenticate(self.a)
            self.client.post("/api/matching/game-night/queue/")
            self.client.force_authenticate(self.b)
            room_id = self.client.post("/api/matching/game-night/queue/").json()["id"]
            report_url = f"/api/matching/game-night/rooms/{room_id}/report/"

            self.client.force_authenticate(self.c)
            self.assertEqual(self.client.post(report_url, {"reason": "Safety concern"}).status_code, 403)

            self.client.force_authenticate(self.a)
            first = self.client.post(report_url, {"reason": "Inappropriate behavior"})
            self.assertEqual(first.status_code, 201)
            self.assertEqual(first.json()["detail"], "Report submitted. This room is closed for you.")
            second = self.client.post(report_url, {"reason": "A duplicate report"})
            self.assertEqual(second.status_code, 201)
            self.assertEqual(GameNightReport.objects.filter(session_id=room_id, reporter=self.a).count(), 1)
            self.assertEqual(GameNightReport.objects.get(session_id=room_id, reporter=self.a).reason, "Inappropriate behavior")
            self.assertEqual(GameNightSession.objects.get(pk=room_id).status, GameNightSession.Status.PASSED)

    def test_admin_can_change_window_and_member_cannot(self):
        window = GameNightWindow.objects.get(weekday=2)
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.patch(f"/api/admin-portal/game-night/windows/{window.id}/", {"start_time": "19:00"}).status_code, 403)
        admin = make_user(4, "female", "everyone", staff=True)
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.patch(f"/api/admin-portal/game-night/windows/{window.id}/", {"start_time": "23:00"}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/admin-portal/game-night/windows/{window.id}/", {"start_time": "18:00"}).status_code, 200)
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time - timedelta(hours=2)):
            self.assertTrue(schedule_snapshot()["is_open"])

    @patch("apps.matching.game_night._choose_game", return_value="split_clue")
    def test_passed_pair_is_not_reintroduced(self, _):
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time):
            Swipe.objects.create(user=self.a, target_user=self.b, action=Swipe.Action.PASS)
            self.client.force_authenticate(self.a)
            self.client.post("/api/matching/game-night/queue/")
            self.client.force_authenticate(self.b)
            self.assertEqual(self.client.post("/api/matching/game-night/queue/").json()["state"], "waiting")
            self.assertFalse(GameNightSession.objects.exists())

    @patch("apps.matching.game_night._choose_game", return_value="plot_twist")
    def test_story_requires_alternating_moves(self, _):
        with patch("apps.matching.game_night.timezone.now", return_value=self.open_time):
            self.client.force_authenticate(self.a)
            self.client.post("/api/matching/game-night/queue/")
            self.client.force_authenticate(self.b)
            room_id = self.client.post("/api/matching/game-night/queue/").json()["id"]
            url = f"/api/matching/game-night/rooms/{room_id}/action/"
            self.assertEqual(self.client.post(url, {"content": "A wild adventure began."}).status_code, 200)
            self.assertEqual(self.client.post(url, {"content": "I keep writing."}).status_code, 400)
            self.client.force_authenticate(self.a)
            self.assertEqual(self.client.post(url, {"content": "Then we found a map."}).status_code, 200)

    def test_admin_rejects_overlapping_windows(self):
        admin = make_user(4, "female", "everyone", staff=True)
        self.client.force_authenticate(admin)
        response = self.client.post("/api/admin-portal/game-night/windows/", {
            "weekday": 2, "start_time": "20:30", "end_time": "21:30",
            "timezone_name": "Asia/Kolkata", "is_enabled": True,
        })
        self.assertEqual(response.status_code, 400)
