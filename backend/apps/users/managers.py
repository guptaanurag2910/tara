from django.contrib.auth.base_user import BaseUserManager
from decimal import Decimal
from datetime import date
import re


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            phone_number = str(extra_fields.get("phone_number") or "")
            phone_digits = re.sub(r"\D", "", phone_number)
            if not phone_digits:
                raise ValueError("Email or phone_number must be set")
            email = f"phone.{phone_digits}@tara.local"
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        # Admin users are created through Django admin flows where
        # profile fields may not be provided interactively.
        extra_fields.setdefault("name", "Admin")
        extra_fields.setdefault("date_of_birth", date(1990, 1, 1))
        extra_fields.setdefault("gender", "other")
        extra_fields.setdefault("preference", "everyone")
        extra_fields.setdefault("birth_place", "Current location")
        extra_fields.setdefault("latitude", Decimal("0.000000"))
        extra_fields.setdefault("longitude", Decimal("0.000000"))
        extra_fields.setdefault("is_birth_time_default", True)

        if not extra_fields.get("name"):
            extra_fields["name"] = "Admin"

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)
