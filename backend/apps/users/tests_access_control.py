import shutil
import tempfile
from base64 import b64decode
from datetime import date, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from apps.astrology.models import BirthDetails
from apps.matching.models import Match

from .models import UserProfileImage

User = get_user_model()
TINY_PNG_BYTES = b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlAbwAAAABJRU5ErkJggg==")


def create_user(
    *,
    email: str,
    name: str,
    phone_number: str,
    gender: str,
    preference: str,
    birth_place: str,
    latitude: str,
    longitude: str,
):
    return User.objects.create_user(
        email=email,
        password="TaraDemo@123",
        name=name,
        phone_number=phone_number,
        date_of_birth=date(1995, 1, 1),
        gender=gender,
        preference=preference,
        birth_place=birth_place,
        birth_time=time(8, 45),
        latitude=Decimal(latitude),
        longitude=Decimal(longitude),
        is_default_location=False,
        is_birth_time_default=False,
        bio=f"Bio for {name}",
        interests=["music", "travel"],
    )


def create_match_between(user_one, user_two, **kwargs):
    ordered_users = sorted([user_one, user_two], key=lambda user: user.id)
    defaults = {
        "kundali_score": 30,
        "personality_score": 80,
        "final_score": 91,
        "match_type": "Cosmic Match",
        "insight_text": "Strong potential.",
        "status": Match.Status.MATCHED,
        "is_visible": True,
    }
    defaults.update(kwargs)
    return Match.objects.create(user_a=ordered_users[0], user_b=ordered_users[1], **defaults)


class AccessControlTests(TestCase):
    def setUp(self):
        self.temp_media_root = tempfile.mkdtemp(prefix="tara-access-control-media-")
        self.media_override = override_settings(MEDIA_ROOT=self.temp_media_root)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)
        self.addCleanup(lambda: shutil.rmtree(self.temp_media_root, ignore_errors=True))

        self.client = APIClient()
        self.user_a = create_user(
            email="access-a@example.com",
            name="Access A",
            phone_number="+919300000001",
            gender="male",
            preference="female",
            birth_place="Mumbai, India",
            latitude="19.076000",
            longitude="72.877700",
        )
        self.user_b = create_user(
            email="access-b@example.com",
            name="Access B",
            phone_number="+919300000002",
            gender="female",
            preference="male",
            birth_place="Delhi, India",
            latitude="28.613900",
            longitude="77.209000",
        )
        self.user_c = create_user(
            email="access-c@example.com",
            name="Access C",
            phone_number="+919300000003",
            gender="female",
            preference="male",
            birth_place="Bengaluru, India",
            latitude="12.971600",
            longitude="77.594600",
        )

        self.user_a_birth = BirthDetails.objects.create(
            user=self.user_a,
            date_of_birth=self.user_a.date_of_birth,
            time_of_birth=self.user_a.birth_time,
            place_of_birth=self.user_a.birth_place,
            latitude=self.user_a.latitude,
            longitude=self.user_a.longitude,
            is_default_location=False,
        )
        self.user_b_birth = BirthDetails.objects.create(
            user=self.user_b,
            date_of_birth=self.user_b.date_of_birth,
            time_of_birth=self.user_b.birth_time,
            place_of_birth=self.user_b.birth_place,
            latitude=self.user_b.latitude,
            longitude=self.user_b.longitude,
            is_default_location=False,
        )

        self.foreign_match = create_match_between(self.user_a, self.user_c)
        self.user_a_photo = UserProfileImage.objects.create(
            user=self.user_a,
            file_token="user-a-photo",
            image=SimpleUploadedFile("user-a.png", TINY_PNG_BYTES, content_type="image/png"),
            display_order=0,
        )

    def test_protected_endpoints_require_authentication(self):
        unauthenticated = APIClient()

        responses = {
            "profile_me": unauthenticated.get("/api/profile/me/"),
            "auth_me": unauthenticated.get("/api/auth/me/"),
            "astrology_birth_details": unauthenticated.get("/api/astrology/birth-details/"),
            "chat_messages": unauthenticated.get(f"/api/chat/{self.foreign_match.id}/messages/"),
            "photo_upload": unauthenticated.post(
                "/api/profile/photos/",
                {"image": SimpleUploadedFile("unauth.png", TINY_PNG_BYTES, content_type="image/png")},
                format="multipart",
            ),
        }

        for label, response in responses.items():
            with self.subTest(endpoint=label):
                self.assertEqual(response.status_code, 401)

    def test_profile_me_is_scoped_to_authenticated_user(self):
        self.client.force_authenticate(self.user_b)

        response = self.client.get(f"/api/profile/me/?user_id={self.user_a.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["basic_info"]["name"], self.user_b.name)
        self.assertEqual(response.data["birth_details"]["birth_place"], self.user_b.birth_place)
        self.assertNotEqual(response.data["basic_info"]["name"], self.user_a.name)
        self.assertNotEqual(response.data["birth_details"]["birth_place"], self.user_a.birth_place)

    def test_non_participant_cannot_access_foreign_match_or_chat(self):
        self.client.force_authenticate(self.user_b)

        match_response = self.client.get(f"/api/matches/{self.foreign_match.id}/")
        chat_response = self.client.get(f"/api/chat/{self.foreign_match.id}/messages/")

        self.assertEqual(match_response.status_code, 404)
        self.assertEqual(chat_response.status_code, 404)

    def test_birth_details_write_cannot_target_another_users_astrology_row(self):
        self.client.force_authenticate(self.user_b)

        response = self.client.put(
            "/api/astrology/birth-details/",
            {
                "user": self.user_a.id,
                "date_of_birth": "1995-01-01",
                "time_of_birth": "10:15",
                "place_of_birth": "New Delhi, India",
                "latitude": "28.613900",
                "longitude": "77.209000",
                "is_default_location": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.user_a_birth.refresh_from_db()
        self.user_b_birth.refresh_from_db()
        self.assertEqual(self.user_a_birth.place_of_birth, "Mumbai, India")
        self.assertEqual(str(self.user_a_birth.time_of_birth), "08:45:00")
        self.assertEqual(self.user_b_birth.place_of_birth, "New Delhi, India")
        self.assertEqual(str(self.user_b_birth.time_of_birth), "10:15:00")

    def test_birth_details_write_cannot_target_another_users_legacy_profile_birth(self):
        self.client.force_authenticate(self.user_b)

        response = self.client.put(
            "/api/birth-details/",
            {
                "user": self.user_a.id,
                "date_of_birth": "1995-01-01",
                "time_of_birth": "11:30",
                "place_of_birth": "Chennai, India",
                "latitude": "13.082700",
                "longitude": "80.270700",
                "is_default_location": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.user_a.refresh_from_db()
        self.user_b.refresh_from_db()
        self.assertEqual(self.user_a.birth_place, "Mumbai, India")
        self.assertEqual(str(self.user_a.birth_time), "08:45:00")
        self.assertEqual(self.user_b.birth_place, "Chennai, India")
        self.assertEqual(str(self.user_b.birth_time), "11:30:00")

    def test_user_cannot_delete_another_users_photo(self):
        self.client.force_authenticate(self.user_b)

        response = self.client.delete(f"/api/profile/photos/{self.user_a_photo.id}/")

        self.assertEqual(response.status_code, 404)
        self.assertTrue(UserProfileImage.objects.filter(id=self.user_a_photo.id, user=self.user_a).exists())
