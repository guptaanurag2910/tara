from decimal import Decimal
from datetime import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from astrology.services.kundali_service import calculate_kundali as calculate_astrology_kundali

from .models import KundaliProfile
from .services.kundali_service import calculate_kundali
from .services.matching_service import calculate_guna_match
from .services.vedic_kundali_engine import calculate_vedic_kundali

User = get_user_model()


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
        expected = calculate_kundali(
            date_of_birth=payload["date_of_birth"],
            birth_time=payload["time_of_birth"],
            latitude=payload["latitude"],
            longitude=payload["longitude"],
        )
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
