import base64

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.games.models import Game, GameCategory, GameOption, GameQuestion
from apps.users.models import PersonalityOption, PersonalityQuestion


class ApiEndToEndSmokeTests(TestCase):
    def setUp(self):
        self.anon = APIClient()
        self.password = "StrongPass@123"

        self.personality_question = PersonalityQuestion.objects.create(
            question_text="In any connection, you value...",
            category="relationships",
            is_active=True,
        )
        self.personality_option = PersonalityOption.objects.create(
            question=self.personality_question,
            option_text="Honesty",
            trait_mapping={"communication": 3},
        )

        self.game_category = GameCategory.objects.create(
            name="Icebreakers",
            slug="icebreakers",
            description="Quick picks",
            is_active=True,
        )
        self.game = Game.objects.create(
            name="This or That",
            description="Three quick picks",
            type=Game.Type.CHOICE,
            is_active=True,
        )
        self.game_question = GameQuestion.objects.create(
            game=self.game,
            category=self.game_category,
            game_type=GameQuestion.GameType.THIS_OR_THAT,
            question_text="Mountains or ocean?",
            options=["Mountains", "Ocean"],
            trait_mapping={},
            tags=[],
            difficulty=1,
            order=1,
            is_active=True,
        )
        self.game_option = GameOption.objects.create(
            question=self.game_question,
            option_text="Mountains",
            order=1,
        )
        GameOption.objects.create(
            question=self.game_question,
            option_text="Ocean",
            order=2,
        )

    def _signup(self, *, name: str, email: str):
        payload = {
            "name": name,
            "email": email,
            "password": self.password,
            "date_of_birth": "1997-01-01",
            "gender": "other",
            "preference": "everyone",
            "birth_place": "Bengaluru",
            "latitude": "12.971600",
            "longitude": "77.594600",
            "is_birth_time_default": True,
        }
        response = self.anon.post("/api/auth/signup/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        return response.data

    def _auth_client(self, access_token: str):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        return client

    def test_profile_basic_enforces_adult_dob(self):
        user = self._signup(name="Teen Check", email="teen.check@tara.demo")
        client = self._auth_client(user["access"])

        response = client.post(
            "/api/profile/basic/",
            {
                "name": "Teen Check",
                "date_of_birth": "2010-01-01",
                "gender": "other",
                "preference": "everyone",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["date_of_birth"][0], "You must be 18+ to use Tara.")

    def test_full_authenticated_api_flow(self):
        response = self.anon.post("/api/profile/basic/", {"name": "x"}, format="json")
        self.assertEqual(response.status_code, 401)

        user1 = self._signup(name="E2E One", email="e2e.one@tara.demo")
        user2 = self._signup(name="E2E Two", email="e2e.two@tara.demo")
        c1 = self._auth_client(user1["access"])
        c2 = self._auth_client(user2["access"])

        self.assertEqual(c1.get("/api/auth/me").status_code, 200)
        self.assertEqual(
            c1.post(
                "/api/profile/basic/",
                {
                    "name": "E2E One Updated",
                    "date_of_birth": "1996-05-21",
                    "gender": "other",
                    "preference": "everyone",
                },
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(
            c1.post(
                "/api/profile/birth/",
                {
                    "birth_place": "Mumbai",
                    "latitude": "19.076000",
                    "longitude": "72.877700",
                    "birth_time": "09:30",
                },
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(
            c2.post(
                "/api/profile/birth/",
                {
                    "birth_place": "Delhi",
                    "latitude": "28.613900",
                    "longitude": "77.209000",
                    "birth_time": "10:30",
                },
                format="json",
            ).status_code,
            200,
        )

        questions = c1.get("/api/personality/questions/")
        self.assertEqual(questions.status_code, 200)
        question_id = questions.data[0]["id"]
        option_id = questions.data[0]["options"][0]["id"]

        self.assertEqual(
            c1.post(
                "/api/personality/response/",
                {"question_id": question_id, "option_id": option_id},
                format="json",
            ).status_code,
            201,
        )
        self.assertEqual(
            c2.post(
                "/api/personality/response/",
                {"question_id": question_id, "option_id": option_id},
                format="json",
            ).status_code,
            201,
        )

        birth_payload_1 = {
            "date_of_birth": "1996-05-21",
            "time_of_birth": "09:30",
            "place_of_birth": "Mumbai",
            "latitude": "19.076000",
            "longitude": "72.877700",
        }
        birth_payload_2 = {
            "date_of_birth": "1998-07-11",
            "time_of_birth": "10:30",
            "place_of_birth": "Delhi",
            "latitude": "28.613900",
            "longitude": "77.209000",
        }
        self.assertEqual(c1.post("/api/birth-details/", birth_payload_1, format="json").status_code, 200)
        self.assertEqual(c2.post("/api/birth-details/", birth_payload_2, format="json").status_code, 200)

        self.assertEqual(c1.get("/api/kundali/").status_code, 200)
        self.assertEqual(c1.get("/api/horoscope/aries/").status_code, 200)
        self.assertEqual(c1.get("/api/profile/me/").status_code, 200)
        self.assertEqual(
            c1.patch(
                "/api/profile/extras/",
                {"bio": "Hello", "interests": ["Astrology"]},
                format="json",
            ).status_code,
            200,
        )

        self.assertEqual(c1.get("/api/profile/photos/").status_code, 200)
        valid_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4x0AAAAASUVORK5CYII="
        )
        image = SimpleUploadedFile("photo.png", valid_png, content_type="image/png")
        uploaded = c1.post("/api/profile/photos/", {"image": image}, format="multipart")
        self.assertEqual(uploaded.status_code, 201)
        photo_id = uploaded.data["id"]
        self.assertEqual(
            c1.post("/api/profile/photos/reorder/", {"photo_ids": [photo_id]}, format="json").status_code,
            200,
        )
        self.assertEqual(c1.delete(f"/api/profile/photos/{photo_id}/").status_code, 204)

        self.assertEqual(c1.get("/api/recommendations/").status_code, 200)

        user2_id = user2["user"]["id"]
        self.assertEqual(
            c1.post("/api/swipe/like/", {"target_user_id": user2_id}, format="json").status_code,
            200,
        )
        user1_id = user1["user"]["id"]
        like_two = c2.post("/api/swipe/like/", {"target_user_id": user1_id}, format="json")
        self.assertEqual(like_two.status_code, 200)
        match_id = like_two.data["match_id"]
        self.assertIsNotNone(match_id)

        profile_summary = c1.get("/api/profile/me/")
        self.assertEqual(profile_summary.status_code, 200)
        self.assertEqual(profile_summary.data["stats"]["matches_count"], 1)
        self.assertEqual(profile_summary.data["stats"]["likes_received_count"], 1)

        self.assertEqual(c1.get("/api/matches/").status_code, 200)
        self.assertEqual(c1.get(f"/api/matches/{match_id}/").status_code, 200)
        self.assertEqual(c1.get(f"/api/matches/{match_id}/icebreakers/").status_code, 200)

        self.assertEqual(c1.get("/api/chat/messages/").status_code, 200)
        self.assertEqual(c1.post("/api/chat/messages/", {"message": "hello"}, format="json").status_code, 201)
        self.assertEqual(
            c1.post(f"/api/chat/{match_id}/message/", {"content": "Hi there"}, format="json").status_code,
            201,
        )
        self.assertEqual(c2.get(f"/api/chat/{match_id}/messages/").status_code, 200)

        self.assertEqual(c2.get("/api/notifications/").status_code, 200)
        self.assertEqual(c2.post("/api/notifications/read/", {}, format="json").status_code, 200)

        self.assertEqual(c1.get("/api/games/").status_code, 200)
        start = c1.post(
            "/api/games/start/",
            {"match_id": match_id, "category": self.game_category.slug},
            format="json",
        )
        self.assertEqual(start.status_code, 201)
        session_id = start.data["session_id"]
        current_question = c1.get(f"/api/games/session/{session_id}/question/")
        self.assertEqual(current_question.status_code, 200)
        question_id = current_question.data["question_id"]

        respond_payload = {
            "session_id": session_id,
            "question_id": question_id,
            "selected_option": self.game_option.id,
        }
        answer_payload = {
            "session_id": session_id,
            "question_id": question_id,
            "selected_option": self.game_option.id,
        }
        self.assertEqual(c1.post("/api/games/respond/", respond_payload, format="json").status_code, 200)
        self.assertEqual(c1.post("/api/games/answer/", answer_payload, format="json").status_code, 200)
        self.assertEqual(c2.post("/api/games/answer/", answer_payload, format="json").status_code, 200)

        self.assertEqual(c1.get("/api/matching/recommendations/").status_code, 200)
        self.assertEqual(c1.get("/api/matching/matches/").status_code, 200)

    def test_phone_number_signup_login_and_password_reset(self):
        phone_number = "+919188887777"
        signup_payload = {
            "phone_number": phone_number,
            "otp": "123456",
            "password": "PhoneAuth@123",
        }
        signup_response = self.anon.post("/api/auth/signup/", signup_payload, format="json")
        self.assertEqual(signup_response.status_code, 201)
        self.assertEqual(signup_response.data["user"]["phone_number"], phone_number)

        login_response = self.anon.post(
            "/api/auth/login/",
            {"phone_number": phone_number, "password": "PhoneAuth@123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.data["user"]["phone_number"], phone_number)

        reset_response = self.anon.post(
            "/api/auth/forgot-password/reset/",
            {
                "phone_number": phone_number,
                "otp": "123456",
                "new_password": "PhoneAuth@456",
            },
            format="json",
        )
        self.assertEqual(reset_response.status_code, 200)

        login_after_reset = self.anon.post(
            "/api/auth/login/",
            {"phone_number": phone_number, "password": "PhoneAuth@456"},
            format="json",
        )
        self.assertEqual(login_after_reset.status_code, 200)
