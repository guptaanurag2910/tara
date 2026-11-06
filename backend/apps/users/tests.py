from base64 import b64decode
from decimal import Decimal
from datetime import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from astrology.services.kundali_service import calculate_kundali as calculate_astrology_kundali
from apps.astrology.models import BirthDetails as AstrologyBirthDetails

from .models import KundaliProfile, PersonalityOption, PersonalityQuestion, PersonalityResponse, Trait
from .services.kundali_service import calculate_kundali
from .services.ashta_koota_service import calculate_ashta_koota_match
from .services.matching_service import calculate_guna_match
from .services.personality_service import calculate_traits, sync_starter_personality_questions
from .services.vedic_kundali_engine import calculate_vedic_kundali, local_to_utc
from .services.vibe_question_bank import REVERSE_KEYED, STATEMENTS, TRAITS

User = get_user_model()
TINY_PNG_BYTES = b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlAbwAAAABJRU5ErkJggg==")


class BirthDetailsKundaliTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="astro.tester@tara.demo",
            password="StrongPass@123",
            name="Astro Tester",
            date_of_birth="1994-06-10",
            gender="other",
            preference="everyone",
            latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"),
            birth_place="Bengaluru, India",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_birth_details_creates_kundali(self):
        payload = {
            "date_of_birth": "1995-02-14",
            "time_of_birth": "08:45",
            "place_of_birth": "Mumbai, India",
            "latitude": "19.076000",
            "longitude": "72.877700",
        }

        response = self.client.post("/api/birth-details/", payload, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertIn("kundali", response.data)
        self.assertTrue(KundaliProfile.objects.filter(user=self.user).exists())

        kundali = KundaliProfile.objects.get(user=self.user)
        astrology_birth = AstrologyBirthDetails.objects.get(user=self.user)
        expected = calculate_kundali(
            date_of_birth=payload["date_of_birth"],
            birth_time=payload["time_of_birth"],
            latitude=payload["latitude"],
            longitude=payload["longitude"],
        )
        self.assertEqual(str(astrology_birth.place_of_birth), payload["place_of_birth"])
        self.assertEqual(str(astrology_birth.latitude), payload["latitude"])
        self.assertEqual(str(astrology_birth.longitude), payload["longitude"])
        self.assertEqual(kundali.moon_sign, expected["moon_sign"])
        self.assertEqual(kundali.nakshatra, expected["nakshatra"])
        self.assertEqual(kundali.nakshatra_pada, expected["nakshatra_pada"])

    def test_update_birth_details_updates_existing_kundali(self):
        first_payload = {
            "date_of_birth": "1992-01-03",
            "time_of_birth": "05:30",
            "place_of_birth": "Delhi, India",
            "latitude": "28.613900",
            "longitude": "77.209000",
        }
        second_payload = {
            "date_of_birth": "1992-09-23",
            "time_of_birth": "19:20",
            "place_of_birth": "Chennai, India",
            "latitude": "13.082700",
            "longitude": "80.270700",
        }

        first_response = self.client.post("/api/birth-details/", first_payload, format="json")
        self.assertEqual(first_response.status_code, 200)

        original = KundaliProfile.objects.get(user=self.user)
        original_pk = original.pk
        original_signature = (
            original.moon_sign,
            original.nakshatra,
            original.nakshatra_pada,
            original.varna,
            original.vashya,
            original.gana,
            original.yoni,
            original.nadi,
            original.bhakoot,
        )

        update_response = self.client.put("/api/birth-details/", second_payload, format="json")
        self.assertEqual(update_response.status_code, 200)

        self.assertEqual(KundaliProfile.objects.filter(user=self.user).count(), 1)
        updated = KundaliProfile.objects.get(user=self.user)
        self.assertEqual(updated.pk, original_pk)

        expected = calculate_kundali(
            date_of_birth=second_payload["date_of_birth"],
            birth_time=second_payload["time_of_birth"],
            latitude=second_payload["latitude"],
            longitude=second_payload["longitude"],
        )

        self.assertEqual(updated.moon_sign, expected["moon_sign"])
        self.assertEqual(updated.nakshatra, expected["nakshatra"])
        self.assertEqual(updated.nakshatra_pada, expected["nakshatra_pada"])
        self.assertEqual(updated.varna, expected["varna"])
        self.assertEqual(updated.vashya, expected["vashya"])
        self.assertEqual(updated.gana, expected["gana"])
        self.assertEqual(updated.yoni, expected["yoni"])
        self.assertEqual(updated.nadi, expected["nadi"])
        self.assertEqual(updated.bhakoot, expected["bhakoot"])

        self.assertEqual(AstrologyBirthDetails.objects.filter(user=self.user).count(), 1)
        astrology_birth = AstrologyBirthDetails.objects.get(user=self.user)
        self.assertEqual(str(astrology_birth.place_of_birth), second_payload["place_of_birth"])
        self.assertEqual(str(astrology_birth.latitude), second_payload["latitude"])
        self.assertEqual(str(astrology_birth.longitude), second_payload["longitude"])

        updated_signature = (
            updated.moon_sign,
            updated.nakshatra,
            updated.nakshatra_pada,
            updated.varna,
            updated.vashya,
            updated.gana,
            updated.yoni,
            updated.nadi,
            updated.bhakoot,
        )
        self.assertNotEqual(updated_signature, original_signature)

    def test_birth_details_rejects_underage_date(self):
        response = self.client.post(
            "/api/birth-details/",
            {
                "date_of_birth": "2010-01-01",
                "place_of_birth": "Mumbai, India",
                "latitude": "19.076000",
                "longitude": "72.877700",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["date_of_birth"][0], "You must be 18+ to use Tara.")

    def test_birth_details_rejects_missing_or_invalid_coordinates(self):
        missing_pair = self.client.post(
            "/api/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "place_of_birth": "Mumbai, India",
                "latitude": "19.076000",
            },
            format="json",
        )
        self.assertEqual(missing_pair.status_code, 400)
        self.assertIn("latitude and longitude", str(missing_pair.data).lower())

        invalid_range = self.client.post(
            "/api/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "place_of_birth": "Mumbai, India",
                "latitude": "91.000000",
                "longitude": "72.877700",
            },
            format="json",
        )
        self.assertEqual(invalid_range.status_code, 400)
        self.assertEqual(invalid_range.data["latitude"][0], "latitude must be between -90 and 90.")

    def test_birth_details_rejects_place_change_without_fresh_coordinates(self):
        first_response = self.client.post(
            "/api/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "time_of_birth": "08:45",
                "place_of_birth": "Mumbai, India",
                "latitude": "19.076000",
                "longitude": "72.877700",
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, 200)

        response = self.client.put(
            "/api/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "time_of_birth": "08:45",
                "place_of_birth": "Chennai, India",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["place_of_birth"][0],
            "latitude and longitude are required when changing place_of_birth.",
        )

    def test_same_input_produces_same_kundali_output(self):
        input_payload = {
            "date_of_birth": "1998-12-05",
            "birth_time": "10:10",
            "latitude": "26.912400",
            "longitude": "75.787300",
        }

        first = calculate_kundali(**input_payload)
        second = calculate_kundali(**input_payload)

        self.assertEqual(first, second)

    def test_change_time_changes_lagna(self):
        morning = calculate_astrology_kundali(
            date_of_birth="1998-12-05",
            time_of_birth="06:00",
            latitude="26.912400",
            longitude="75.787300",
        )
        evening = calculate_astrology_kundali(
            date_of_birth="1998-12-05",
            time_of_birth="18:00",
            latitude="26.912400",
            longitude="75.787300",
        )

        self.assertNotEqual(morning["lagna"], evening["lagna"])

    def test_get_kundali_endpoint_returns_stored_kundali(self):
        payload = {
            "date_of_birth": "1991-11-21",
            "time_of_birth": "09:25",
            "place_of_birth": "Pune, India",
            "latitude": "18.520400",
            "longitude": "73.856700",
        }
        create_response = self.client.post("/api/birth-details/", payload, format="json")
        self.assertEqual(create_response.status_code, 200)

        response = self.client.get("/api/kundali/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("moon_sign", response.data)
        self.assertIn("nakshatra", response.data)
        self.assertIn("nadi", response.data)
        self.assertIn("chart_data", response.data)
        self.assertIn("houses", response.data)
        self.assertIn("planets", response.data)

    def test_horoscope_api_returns_career_love_finance(self):
        response = self.client.get("/api/horoscope/cancer/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sign"], "Cancer")
        self.assertIn("career", response.data)
        self.assertIn("love", response.data)
        self.assertIn("finance", response.data)

    def test_horoscope_api_rejects_invalid_sign(self):
        response = self.client.get("/api/horoscope/not-a-sign/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)


class ProfilePhotoUploadTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="photo.tester@tara.demo",
            password="StrongPass@123",
            name="Photo Tester",
            date_of_birth="1994-06-10",
            gender="female",
            preference="male",
            latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"),
            birth_place="Bengaluru, India",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_profile_photo_upload_accepts_valid_png(self):
        image = SimpleUploadedFile("photo.png", TINY_PNG_BYTES, content_type="image/png")

        response = self.client.post("/api/profile/photos/", {"image": image}, format="multipart")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.user.profile_images.count(), 1)
        self.assertEqual(self.user.profile_images.first().display_order, 0)

    def test_profile_photo_upload_rejects_fake_image_content(self):
        image = SimpleUploadedFile("photo.png", b"not-really-a-png", content_type="image/png")

        response = self.client.post("/api/profile/photos/", {"image": image}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["image"][0], "Upload a valid image file.")
        self.assertEqual(self.user.profile_images.count(), 0)

    def test_profile_photo_upload_retries_create_ordered_rows(self):
        first = SimpleUploadedFile("photo1.png", TINY_PNG_BYTES, content_type="image/png")
        second = SimpleUploadedFile("photo2.png", TINY_PNG_BYTES, content_type="image/png")

        first_response = self.client.post("/api/profile/photos/", {"image": first}, format="multipart")
        second_response = self.client.post("/api/profile/photos/", {"image": second}, format="multipart")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        rows = list(self.user.profile_images.order_by("display_order", "id").values_list("id", "display_order"))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0][1], 0)
        self.assertEqual(rows[1][1], 1)

    def test_profile_photo_reorder_preserves_unique_order_sequence(self):
        first = SimpleUploadedFile("photo1.png", TINY_PNG_BYTES, content_type="image/png")
        second = SimpleUploadedFile("photo2.png", TINY_PNG_BYTES, content_type="image/png")
        third = SimpleUploadedFile("photo3.png", TINY_PNG_BYTES, content_type="image/png")

        first_response = self.client.post("/api/profile/photos/", {"image": first}, format="multipart")
        second_response = self.client.post("/api/profile/photos/", {"image": second}, format="multipart")
        third_response = self.client.post("/api/profile/photos/", {"image": third}, format="multipart")

        photo_ids = [
            first_response.data["id"],
            second_response.data["id"],
            third_response.data["id"],
        ]
        response = self.client.post(
            "/api/profile/photos/reorder/",
            {"photo_ids": [photo_ids[2], photo_ids[0], photo_ids[1]]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        rows = list(self.user.profile_images.order_by("display_order", "id").values_list("id", "display_order"))
        self.assertEqual(rows, [(photo_ids[2], 0), (photo_ids[0], 1), (photo_ids[1], 2)])


class PersonalityResponseFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="personality.tester@tara.demo",
            password="StrongPass@123",
            name="Personality Tester",
            date_of_birth="1994-06-10",
            gender="female",
            preference="male",
            latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"),
            birth_place="Bengaluru, India",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.question_one = PersonalityQuestion.objects.create(
            question_text="Big decisions come from...",
            category=PersonalityQuestion.Category.PERSONALITY,
            is_active=True,
        )
        self.question_two = PersonalityQuestion.objects.create(
            question_text="When life feels heavy, you...",
            category=PersonalityQuestion.Category.EMOTIONS,
            is_active=True,
        )
        self.option_one_a = PersonalityOption.objects.create(
            question=self.question_one,
            option_text="Logic",
            trait_mapping={"stability": 2, "overthinking": 1},
        )
        self.option_one_b = PersonalityOption.objects.create(
            question=self.question_one,
            option_text="Instinct",
            trait_mapping={"openness": 2, "emotional_depth": 1},
        )
        self.option_two = PersonalityOption.objects.create(
            question=self.question_two,
            option_text="Talk it out",
            trait_mapping={"communication": 3, "emotional_depth": 1},
        )

    def test_fetch_personality_questions_returns_options(self):
        response = self.client.get("/api/personality/questions/")

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 2)
        first = response.data[0]
        self.assertIn("question_text", first)
        self.assertIn("options", first)
        self.assertGreaterEqual(len(first["options"]), 1)

    def test_submiting_all_questions_creates_responses_and_traits(self):
        first = self.client.post(
            "/api/personality/response/",
            {"question_id": self.question_one.id, "option_id": self.option_one_a.id},
            format="json",
        )
        second = self.client.post(
            "/api/personality/response/",
            {"question_id": self.question_two.id, "option_id": self.option_two.id},
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(PersonalityResponse.objects.filter(user=self.user).count(), 2)

        trait_profile = Trait.objects.get(user=self.user)
        self.assertIn("emotional_depth", trait_profile.traits)
        self.assertIn("communication", trait_profile.traits)

        summary = self.client.get("/api/profile/me/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(len(summary.data["personality_responses"]), 2)
        self.assertEqual(summary.data["traits"], trait_profile.traits)

    def test_duplicate_response_updates_in_place_without_creating_junk_rows(self):
        first = self.client.post(
            "/api/personality/response/",
            {"question_id": self.question_one.id, "option_id": self.option_one_a.id},
            format="json",
        )
        updated = self.client.post(
            "/api/personality/response/",
            {"question_id": self.question_one.id, "option_id": self.option_one_b.id},
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(PersonalityResponse.objects.filter(user=self.user, question=self.question_one).count(), 1)

        response_obj = PersonalityResponse.objects.get(user=self.user, question=self.question_one)
        self.assertEqual(response_obj.selected_option_id, self.option_one_b.id)

        trait_profile = Trait.objects.get(user=self.user)
        self.assertIn("openness", trait_profile.traits)
        self.assertNotIn("communication", trait_profile.traits)


class VibeQuestionBankTests(TestCase):
    def test_existing_sixty_statements_keep_their_reverse_keyed_scoring(self):
        user = User.objects.create_user(
            email="vibe.bank@tara.demo", password="StrongPass@123", date_of_birth="1994-06-10",
            gender="other", preference="everyone", latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"), birth_place="Bengaluru, India",
        )
        sync_starter_personality_questions()
        questions = list(PersonalityQuestion.objects.filter(is_active=True).prefetch_related("options").order_by("id"))

        self.assertEqual(len(questions), len(STATEMENTS))
        self.assertEqual([len(question.options.all()) for question in questions], [5] * len(STATEMENTS))
        client = APIClient()
        client.force_authenticate(user=user)
        api_questions = client.get("/api/personality/questions/")
        self.assertEqual(api_questions.status_code, 200)
        self.assertEqual(api_questions.data[0]["question_text"], STATEMENTS[0])
        responses = []
        for index, question in enumerate(questions):
            preferred_label = "Strongly disagree" if index in REVERSE_KEYED else "Strongly agree"
            selected = next(option for option in question.options.all() if option.option_text == preferred_label)
            responses.append(PersonalityResponse(user=user, question=question, selected_option=selected))

        PersonalityResponse.objects.bulk_create(responses[:-1])
        self.assertEqual(calculate_traits(user), {})
        PersonalityResponse.objects.create(user=user, question=responses[-1].question, selected_option=responses[-1].selected_option)
        scores = calculate_traits(user)
        self.assertEqual(set(scores), set(TRAITS))
        self.assertTrue(all(score == 10 for score in scores.values()))


class _FakeSwe:
    SUN = 0
    MOON = 1
    MARS = 2
    MERCURY = 3
    JUPITER = 4
    VENUS = 5
    SATURN = 6
    MEAN_NODE = 7
    SIDM_LAHIRI = 1
    FLG_SWIEPH = 2
    FLG_SIDEREAL = 4

    def set_sid_mode(self, _mode):
        return None

    def julday(self, year, month, day, hour_decimal):
        return (year * 372) + (month * 31) + day + (hour_decimal / 24.0)

    def calc_ut(self, julian_day_ut, planet_id, _flags=0):
        degree = ((planet_id * 31.5) + (julian_day_ut * 11.7)) % 360.0
        return ([degree, 0.0, 0.0, 0.0, 0.0, 0.0], 0)

    def houses_ex(self, julian_day_ut, latitude, longitude, _house_system, _flags):
        ascendant = ((julian_day_ut * 1440.0) + (latitude * 1.3) + (longitude * 0.7)) % 360.0
        return ([0.0] * 13, [ascendant] + [0.0] * 9)

    def houses(self, julian_day_ut, latitude, longitude):
        ascendant = ((julian_day_ut * 1440.0) + (latitude * 1.3) + (longitude * 0.7)) % 360.0
        return ([0.0] * 13, [ascendant] + [0.0] * 9)

    def get_ayanamsa_ut(self, _julian_day_ut):
        return 24.0


class VedicKundaliEngineTests(TestCase):
    def _run_chart(self, *, date_of_birth, time_of_birth, latitude, longitude):
        fake_swe = _FakeSwe()

        with (
            patch("apps.users.services.vedic_kundali_engine._require_swisseph", return_value=fake_swe),
            patch("apps.users.services.vedic_kundali_engine.get_timezone_name", return_value="Asia/Kolkata"),
            patch(
                "apps.users.services.vedic_kundali_engine.local_to_utc",
                side_effect=lambda dob, tob, _tz: datetime.combine(dob, tob),
            ),
        ):
            return calculate_vedic_kundali(
                date_of_birth=date_of_birth,
                time_of_birth=time_of_birth,
                place_of_birth="Bengaluru, India",
                latitude=latitude,
                longitude=longitude,
            )

    def test_same_input_produces_same_output(self):
        payload = {
            "date_of_birth": "1998-12-05",
            "time_of_birth": "10:10",
            "latitude": 26.9124,
            "longitude": 75.7873,
        }
        first = self._run_chart(**payload)
        second = self._run_chart(**payload)
        self.assertEqual(first, second)

    def test_change_time_by_one_hour_changes_lagna(self):
        morning = self._run_chart(
            date_of_birth="1998-12-05",
            time_of_birth="06:00",
            latitude=26.9124,
            longitude=75.7873,
        )
        later = self._run_chart(
            date_of_birth="1998-12-05",
            time_of_birth="07:00",
            latitude=26.9124,
            longitude=75.7873,
        )
        self.assertNotEqual(morning["lagna"], later["lagna"])

    def test_change_location_changes_lagna(self):
        city_one = self._run_chart(
            date_of_birth="1998-12-05",
            time_of_birth="06:00",
            latitude=12.9716,
            longitude=77.5946,
        )
        city_two = self._run_chart(
            date_of_birth="1998-12-05",
            time_of_birth="06:00",
            latitude=28.6139,
            longitude=77.2090,
        )
        self.assertNotEqual(city_one["lagna"], city_two["lagna"])

    def test_planetary_degrees_stay_in_range(self):
        result = self._run_chart(
            date_of_birth="1997-01-01",
            time_of_birth="13:45",
            latitude=19.0760,
            longitude=72.8777,
        )

        planets = result["planets"]
        for name, payload in planets.items():
            degree = float(payload["degree"])
            self.assertGreaterEqual(degree, 0.0, msg=f"{name} below 0")
            self.assertLess(degree, 360.0, msg=f"{name} above/equal 360")


class AshtaKootaMatchingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.request_user = User.objects.create_user(
            email="match.requester@tara.demo",
            password="StrongPass@123",
            name="Requester",
            date_of_birth="1994-01-01",
            gender="other",
            preference="everyone",
            latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"),
            birth_place="Bengaluru",
        )
        self.client.force_authenticate(user=self.request_user)

    def _create_user_with_kundali(self, *, email: str, moon_sign: str, nakshatra: str):
        user = User.objects.create_user(
            email=email,
            password="StrongPass@123",
            name=email.split("@")[0],
            date_of_birth="1995-01-01",
            gender="other",
            preference="everyone",
            latitude=Decimal("28.613900"),
            longitude=Decimal("77.209000"),
            birth_place="Delhi",
        )
        KundaliProfile.objects.create(
            user=user,
            lagna=moon_sign,
            sun_sign=moon_sign,
            moon_sign=moon_sign,
            nakshatra=nakshatra,
            nakshatra_pada=1,
            varna="",
            vashya="",
            gana="",
            yoni="",
            nadi="",
            bhakoot="",
            chart_data={},
            is_accurate=True,
        )
        return user

    def test_same_nakshatra_sets_nadi_to_zero(self):
        result = calculate_guna_match(
            {"moon_sign": "Aries", "nakshatra": "Ashwini", "rashi_lord": "Mars"},
            {"moon_sign": "Leo", "nakshatra": "Ashwini", "rashi_lord": "Sun"},
        )
        self.assertEqual(result["breakdown"]["nadi"], 0)

    def test_compatible_pair_scores_higher(self):
        compatible = calculate_guna_match(
            {"moon_sign": "Cancer", "nakshatra": "Pushya", "rashi_lord": "Moon"},
            {"moon_sign": "Pisces", "nakshatra": "Revati", "rashi_lord": "Jupiter"},
        )
        opposing = calculate_guna_match(
            {"moon_sign": "Aries", "nakshatra": "Ashwini", "rashi_lord": "Mars"},
            {"moon_sign": "Virgo", "nakshatra": "Chitra", "rashi_lord": "Mercury"},
        )
        self.assertGreaterEqual(compatible["total_score"], 24)
        self.assertGreater(compatible["total_score"], opposing["total_score"])

    def test_kundali_match_api_returns_breakdown(self):
        user1 = self._create_user_with_kundali(
            email="kundali.a@tara.demo",
            moon_sign="Cancer",
            nakshatra="Pushya",
        )
        user2 = self._create_user_with_kundali(
            email="kundali.b@tara.demo",
            moon_sign="Pisces",
            nakshatra="Revati",
        )

        response = self.client.post(
            "/api/kundali-match/",
            {"user1_id": user1.id, "user2_id": user2.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("total_score", response.data)
        self.assertIn("compatibility", response.data)
        self.assertIn("breakdown", response.data)
        self.assertIn("nadi", response.data["breakdown"])


class KundaliReferenceFixtureTests(TestCase):
    """Regression checks against published Swiss Ephemeris reference charts."""

    def test_varanasi_reference_chart(self):
        chart = calculate_vedic_kundali(
            date_of_birth="1990-05-15", time_of_birth="14:30",
            place_of_birth="Varanasi, India", latitude=25.31668, longitude=83.01041,
        )
        self.assertAlmostEqual(chart["ascendant_degree"], 157.037, places=2)
        expected = {"Sun": 30.55, "Moon": 271.894, "Mars": 324.515, "Mercury": 14.302,
                    "Jupiter": 75.792, "Venus": 348.95, "Saturn": 271.526, "Rahu": 287.62, "Ketu": 107.62}
        for planet, longitude in expected.items():
            self.assertAlmostEqual(chart["planets"][planet]["degree"], longitude, places=2, msg=planet)

    def test_delhi_reference_chart(self):
        chart = calculate_vedic_kundali(
            date_of_birth="1975-12-25", time_of_birth="23:55",
            place_of_birth="Delhi, India", latitude=28.6139, longitude=77.209,
        )
        self.assertAlmostEqual(chart["ascendant_degree"], 153.921, places=2)
        self.assertAlmostEqual(chart["planets"]["Moon"]["degree"], 161.754, places=2)

    def test_dst_gap_and_repeated_hour_are_not_silently_guessed(self):
        with self.assertRaisesRegex(ValueError, "did not occur"):
            local_to_utc("2021-03-14", "02:30", "America/New_York")
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            local_to_utc("2021-11-07", "01:30", "America/New_York")


class AshtaKootaRuleTests(TestCase):
    def test_tara_awards_half_points_when_only_one_direction_is_favorable(self):
        # Rohini to Bharani is unfavorable; the reverse direction is favorable.
        result = calculate_ashta_koota_match(
            {"nakshatra": "Rohini", "moon_sign": "Taurus"},
            {"nakshatra": "Bharani", "moon_sign": "Aries"},
        )
        self.assertEqual(result["breakdown"]["tara"], 1.5)
        self.assertEqual(result["total_score"], round(sum(result["breakdown"].values()), 2))

    def test_gana_score_does_not_depend_on_profile_order(self):
        deva = {"nakshatra": "Ashwini", "moon_sign": "Aries"}
        manushya = {"nakshatra": "Bharani", "moon_sign": "Aries"}
        first = calculate_ashta_koota_match(deva, manushya)
        second = calculate_ashta_koota_match(manushya, deva)
        self.assertEqual(first["breakdown"]["gana"], second["breakdown"]["gana"])
