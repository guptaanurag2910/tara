from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from .models import BirthDetails, Kundali
from .services.kundali_service import calculate_kundali_payload

User = get_user_model()


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
        ascendant = ((julian_day_ut * 123.45) + (latitude * 1.3) + (longitude * 0.7)) % 360.0
        return ([0.0] * 13, [ascendant] + [0.0] * 9)


class AstrologyModuleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="astro.module@tara.demo",
            password="StrongPass@123",
            name="Astro Module User",
            date_of_birth="1994-06-10",
            gender="other",
            preference="everyone",
            latitude=Decimal("12.971600"),
            longitude=Decimal("77.594600"),
            birth_place="Bengaluru, India",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.patchers = [
            patch("apps.astrology.services.ephemeris_service._require_swe", return_value=_FakeSwe()),
            patch("apps.astrology.services.ephemeris_service.get_timezone_name", return_value="Asia/Kolkata"),
            patch(
                "apps.astrology.services.ephemeris_service.local_to_utc",
                side_effect=lambda dob, tob, _tz: datetime.combine(dob, tob),
            ),
            patch(
                "apps.astrology.views.get_coordinates",
                return_value=type("Coord", (), {"latitude": 19.076, "longitude": 72.8777})(),
            ),
        ]
        for p in self.patchers:
            p.start()

    def tearDown(self):
        for p in self.patchers:
            p.stop()

    def test_create_birth_details_creates_kundali(self):
        payload = {
            "date_of_birth": "1995-02-14",
            "time_of_birth": "08:45",
            "place_of_birth": "Mumbai, India",
            "latitude": "19.076000",
            "longitude": "72.877700",
            "is_default_location": True,
        }
        response = self.client.post("/api/astrology/birth-details/", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(BirthDetails.objects.filter(user=self.user).exists())
        self.assertTrue(Kundali.objects.filter(user=self.user).exists())
        self.assertEqual(bool(response.data.get("is_default_location")), True)

    def test_update_birth_details_updates_kundali(self):
        self.client.post(
            "/api/astrology/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "time_of_birth": "08:45",
                "place_of_birth": "Mumbai, India",
                "latitude": "19.076000",
                "longitude": "72.877700",
            },
            format="json",
        )
        original = Kundali.objects.get(user=self.user)
        original_updated_at = original.updated_at

        response = self.client.put(
            "/api/astrology/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "time_of_birth": "09:45",
                "place_of_birth": "Mumbai, India",
                "latitude": "19.076000",
                "longitude": "72.877700",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        updated = Kundali.objects.get(user=self.user)
        self.assertGreaterEqual(updated.updated_at, original_updated_at)

    def test_same_input_same_kundali(self):
        payload = {
            "date_of_birth": "1998-12-05",
            "time_of_birth": "10:10",
            "place_of_birth": "Jaipur, India",
            "latitude": 26.9124,
            "longitude": 75.7873,
        }
        first = calculate_kundali_payload(**payload)
        second = calculate_kundali_payload(**payload)
        self.assertEqual(first, second)

    def test_change_time_changes_lagna(self):
        common = {
            "date_of_birth": "1998-12-05",
            "place_of_birth": "Jaipur, India",
            "latitude": 26.9124,
            "longitude": 75.7873,
        }
        morning = calculate_kundali_payload(time_of_birth="06:00", **common)
        evening = calculate_kundali_payload(time_of_birth="18:00", **common)
        self.assertNotEqual(morning["lagna"], evening["lagna"])

    def test_horoscope_cached_for_day(self):
        self.client.post(
            "/api/astrology/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "time_of_birth": "08:45",
                "place_of_birth": "Mumbai, India",
                "latitude": "19.076000",
                "longitude": "72.877700",
            },
            format="json",
        )
        first = self.client.get("/api/astrology/daily-horoscope/")
        second = self.client.get("/api/astrology/daily-horoscope/")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data.get("date"), date.today().isoformat())
        self.assertEqual(first.data, second.data)

    def test_planet_degrees_within_bounds(self):
        payload = calculate_kundali_payload(
            date_of_birth="1995-02-14",
            time_of_birth="08:45",
            place_of_birth="Mumbai, India",
            latitude=19.0760,
            longitude=72.8777,
        )
        planets = payload["chart_data"]["planets"]
        for name, data in planets.items():
            degree = float(data["degree"])
            self.assertGreaterEqual(degree, 0.0, msg=f"{name} below 0")
            self.assertLess(degree, 360.0, msg=f"{name} >= 360")

    @override_settings(ASTRO_BIRTH_DETAILS_GEOCODE_FALLBACK=False)
    def test_birth_details_rejects_missing_coordinates_when_fallback_disabled(self):
        response = self.client.post(
            "/api/astrology/birth-details/",
            {
                "date_of_birth": "1995-02-14",
                "time_of_birth": "08:45",
                "place_of_birth": "Mumbai, India",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude and longitude", str(response.data.get("detail", "")).lower())

    def test_location_search_endpoint(self):
        with patch(
            "apps.astrology.views.search_places",
            return_value=[{"display_name": "Bengaluru, Karnataka, India", "latitude": "12.971600", "longitude": "77.594600", "place_id": "123"}],
        ):
            response = self.client.get("/api/astrology/location/search/?q=benga")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["display_name"], "Bengaluru, Karnataka, India")

    def test_location_reverse_endpoint(self):
        with patch(
            "apps.astrology.views.reverse_geocode",
            return_value={"display_name": "Delhi, India", "latitude": "28.613900", "longitude": "77.209000"},
        ):
            response = self.client.get("/api/astrology/location/reverse/?latitude=28.6139&longitude=77.2090")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["display_name"], "Delhi, India")
