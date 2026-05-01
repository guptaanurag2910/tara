from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Notification

User = get_user_model()


def create_user(
    *,
    email: str,
    name: str,
    phone_number: str,
):
    return User.objects.create_user(
        email=email,
        password="TaraDemo@123",
        name=name,
        phone_number=phone_number,
        date_of_birth=date(1995, 1, 1),
        gender="other",
        preference="everyone",
        birth_place="Bengaluru, Karnataka, India",
        latitude=Decimal("12.971600"),
        longitude=Decimal("77.594600"),
        is_default_location=False,
        is_birth_time_default=False,
        bio="",
        interests=[],
    )


class NotificationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = create_user(
            email="notify-one@example.com",
            name="Notify One",
            phone_number="+919122220001",
        )
        self.other_user = create_user(
            email="notify-two@example.com",
            name="Notify Two",
            phone_number="+919122220002",
        )

    def test_notification_list_returns_only_authenticated_users_rows(self):
        own = Notification.objects.create(
            user=self.user,
            type=Notification.Type.MESSAGE,
            text="Someone messaged you 👀",
        )
        Notification.objects.create(
            user=self.other_user,
            type=Notification.Type.MATCH,
            text="You have a new match 🔮",
        )

        self.client.force_authenticate(self.user)
        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], own.id)
        self.assertEqual(payload[0]["text"], own.text)
        self.assertEqual(payload[0]["type"], Notification.Type.MESSAGE)
        self.assertFalse(payload[0]["is_read"])
        self.assertIn("timestamp", payload[0])

    def test_mark_read_updates_only_current_users_unread_rows(self):
        own_unread = Notification.objects.create(
            user=self.user,
            type=Notification.Type.MATCH,
            text="You have a new match 🔮",
        )
        own_read = Notification.objects.create(
            user=self.user,
            type=Notification.Type.RECOMMENDATION,
            text="Your top match today is waiting ✨",
            is_read=True,
        )
        foreign_unread = Notification.objects.create(
            user=self.other_user,
            type=Notification.Type.MESSAGE,
            text="Someone messaged you 👀",
        )

        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/notifications/read/",
            {"notification_ids": [own_unread.id, foreign_unread.id]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 1)

        own_unread.refresh_from_db()
        own_read.refresh_from_db()
        foreign_unread.refresh_from_db()

        self.assertTrue(own_unread.is_read)
        self.assertTrue(own_read.is_read)
        self.assertFalse(foreign_unread.is_read)
