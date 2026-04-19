from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


def profile_image_upload_to(instance, filename):
    extension = ""
    if "." in filename:
        extension = filename.rsplit(".", 1)[-1].lower()
    safe_extension = extension if extension else "jpg"
    return f"profile_image/{instance.user_id}/{instance.file_token}.{safe_extension}"


class User(AbstractUser):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        NON_BINARY = "non_binary", "Non Binary"
        OTHER = "other", "Other"

    class Preference(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        EVERYONE = "everyone", "Everyone"

    username = None
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=20, choices=Gender.choices)
    preference = models.CharField(max_length=20, choices=Preference.choices)
    birth_place = models.CharField(max_length=255, blank=True, default="")
    birth_time = models.TimeField(null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    is_default_location = models.BooleanField(default=False)
    is_birth_time_default = models.BooleanField(default=False)
    bio = models.TextField(blank=True, default="")
    interests = models.JSONField(default=list, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    def __str__(self) -> str:
        return self.phone_number or self.email


class PersonalityQuestion(models.Model):
    class Category(models.TextChoices):
        PERSONALITY = "personality", "Personality"
        EMOTIONS = "emotions", "Emotions"
        RELATIONSHIPS = "relationships", "Relationships"

    question_text = models.TextField()
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.PERSONALITY)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.category}: {self.question_text[:50]}"


class PersonalityOption(models.Model):
    question = models.ForeignKey(
        PersonalityQuestion,
        on_delete=models.CASCADE,
        related_name="options",
    )
    option_text = models.CharField(max_length=255)
    trait_mapping = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"Q{self.question_id}: {self.option_text[:50]}"


class PersonalityResponse(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="personality_responses")
    question = models.ForeignKey(
        PersonalityQuestion,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    selected_option = models.ForeignKey(
        PersonalityOption,
        on_delete=models.PROTECT,
        related_name="responses",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "question"], name="unique_user_question_response"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} -> Q{self.question_id} (Option {self.selected_option_id})"


class Trait(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="trait_profile")
    traits = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"Traits for user {self.user_id}"


class KundaliProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="kundali_profile")
    lagna = models.CharField(max_length=100, blank=True, default="")
    sun_sign = models.CharField(max_length=100, blank=True, default="")
    moon_sign = models.CharField(max_length=100)
    ascendant_degree = models.FloatField(null=True, blank=True)
    nakshatra = models.CharField(max_length=100)
    nakshatra_pada = models.PositiveSmallIntegerField()
    varna = models.CharField(max_length=100)
    vashya = models.CharField(max_length=100)
    gana = models.CharField(max_length=100)
    yoni = models.CharField(max_length=100)
    nadi = models.CharField(max_length=100)
    bhakoot = models.CharField(max_length=100)
    timezone_name = models.CharField(max_length=64, blank=True, default="")
    chart_data = models.JSONField(default=dict, blank=True)
    is_accurate = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"Kundali for user {self.user_id}"


class UserProfileImage(models.Model):
    MAX_PHOTOS_PER_USER = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="profile_images")
    file_token = models.CharField(max_length=40)
    image = models.FileField(upload_to=profile_image_upload_to)
    display_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["display_order", "id"]
        indexes = [
            models.Index(fields=["user", "display_order"], name="usr_prof_img_user_order_idx"),
        ]

    def __str__(self) -> str:
        return f"Profile image {self.id} for user {self.user_id}"
