from django.db.models import Q
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import date
from decimal import Decimal
import re
from uuid import uuid4

from apps.matching.models import DailyRecommendation, Match, Swipe
from .models import KundaliProfile, PersonalityOption, PersonalityQuestion, PersonalityResponse, Trait, UserProfileImage

User = get_user_model()
HARD_CODED_OTP = "123456"


def detect_image_format(uploaded_file) -> str | None:
    try:
        original_position = uploaded_file.tell()
    except Exception:
        original_position = None

    try:
        uploaded_file.seek(0)
    except Exception:
        pass

    try:
        header = uploaded_file.read(32) or b""
    finally:
        try:
            if original_position is not None:
                uploaded_file.seek(original_position)
            else:
                uploaded_file.seek(0)
        except Exception:
            pass

    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "webp"
    if header.startswith(b"BM"):
        return "bmp"
    if header.startswith((b"II*\x00", b"MM\x00*")):
        return "tiff"
    if len(header) >= 12 and header[4:8] == b"ftyp":
        brand = header[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1", b"avif", b"avis"}:
            return brand.decode("ascii", errors="ignore")
    return None


def normalize_phone_number(value: str) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) < 8 or len(digits) > 15:
        raise serializers.ValidationError("phone_number must contain 8 to 15 digits.")
    return f"+{digits}"


def build_phone_email(phone_number: str) -> str:
    digits = re.sub(r"\D", "", str(phone_number or ""))
    return f"phone.{digits}@tara.local"


class UserSerializer(serializers.ModelSerializer):
    photos = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "phone_number",
            "date_of_birth",
            "gender",
            "preference",
            "birth_place",
            "birth_time",
            "latitude",
            "longitude",
            "is_default_location",
            "is_birth_time_default",
            "bio",
            "interests",
            "photos",
        ]

    def get_photos(self, obj):
        images = obj.profile_images.all().order_by("display_order", "id")
        return UserProfileImageSerializer(images, many=True, context=self.context).data


class SignupSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)
    otp = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False)
    gender = serializers.ChoiceField(choices=User.Gender.choices, required=False)
    preference = serializers.ChoiceField(choices=User.Preference.choices, required=False)
    birth_place = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    is_birth_time_default = serializers.BooleanField(required=False)
    is_default_location = serializers.BooleanField(required=False)
    bio = serializers.CharField(required=False, allow_blank=True)
    interests = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = User
        fields = [
            "name",
            "email",
            "phone_number",
            "otp",
            "password",
            "date_of_birth",
            "gender",
            "preference",
            "birth_place",
            "birth_time",
            "latitude",
            "longitude",
            "is_default_location",
            "is_birth_time_default",
            "bio",
            "interests",
        ]
        extra_kwargs = {
            "date_of_birth": {"required": False},
            "gender": {"required": False},
            "preference": {"required": False},
            "birth_place": {"required": False},
            "birth_time": {"required": False},
            "latitude": {"required": False},
            "longitude": {"required": False},
            "is_default_location": {"required": False},
            "is_birth_time_default": {"required": False},
        }

    def validate(self, attrs):
        phone_number = attrs.get("phone_number")
        email = str(attrs.get("email") or "").strip()
        otp = str(attrs.get("otp") or "").strip()

        if phone_number:
            normalized_phone = normalize_phone_number(phone_number)
            attrs["phone_number"] = normalized_phone
            if User.objects.filter(phone_number=normalized_phone).exists():
                raise serializers.ValidationError({"phone_number": "This phone number is already registered."})
            if otp != HARD_CODED_OTP:
                raise serializers.ValidationError({"otp": "Invalid OTP. Use 123456 for now."})
            attrs["email"] = email or build_phone_email(normalized_phone)
        else:
            if not email:
                raise serializers.ValidationError({"phone_number": "phone_number is required for signup."})

        if "latitude" in attrs and "longitude" not in attrs:
            raise serializers.ValidationError({"longitude": "longitude is required when latitude is provided."})
        if "longitude" in attrs and "latitude" not in attrs:
            raise serializers.ValidationError({"latitude": "latitude is required when longitude is provided."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("otp", None)

        phone_number = validated_data.get("phone_number")
        if phone_number:
            validated_data.setdefault("name", f"Tara {phone_number[-4:]}")
            validated_data.setdefault("date_of_birth", date(1998, 1, 1))
            validated_data.setdefault("gender", User.Gender.OTHER)
            validated_data.setdefault("preference", User.Preference.EVERYONE)
            validated_data.setdefault("birth_place", "Current location")
            validated_data.setdefault("latitude", Decimal("12.971600"))
            validated_data.setdefault("longitude", Decimal("77.594600"))
            validated_data.setdefault("is_default_location", True)
            validated_data.setdefault("is_birth_time_default", True)
            candidate_email = validated_data.get("email") or build_phone_email(phone_number)
            if User.objects.filter(email=candidate_email).exists():
                candidate_email = f"{candidate_email.split('@')[0]}.{uuid4().hex[:6]}@tara.local"
            validated_data["email"] = candidate_email

        user = User.objects.create_user(password=password, **validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        password = attrs.get("password")
        phone_number = str(attrs.get("phone_number") or "").strip()
        email = str(attrs.get("email") or "").strip()

        user = None
        if phone_number:
            normalized_phone = normalize_phone_number(phone_number)
            attrs["phone_number"] = normalized_phone
            user = User.objects.filter(phone_number=normalized_phone).first()
        elif email:
            user = User.objects.filter(email__iexact=email).first()
        else:
            raise serializers.ValidationError({"phone_number": "phone_number is required."})

        if user is None or not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid phone number or password."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "Account is inactive."})

        attrs["user"] = user
        return attrs


class ForgotPasswordResetSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        normalized_phone = normalize_phone_number(attrs.get("phone_number"))
        attrs["phone_number"] = normalized_phone
        if str(attrs.get("otp") or "").strip() != HARD_CODED_OTP:
            raise serializers.ValidationError({"otp": "Invalid OTP. Use 123456 for now."})

        user = User.objects.filter(phone_number=normalized_phone).first()
        if user is None:
            raise serializers.ValidationError({"phone_number": "No user found with this phone number."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "Account is inactive."})
        attrs["user"] = user
        return attrs


class PhoneStatusSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)

    def validate_phone_number(self, value):
        return normalize_phone_number(value)


class AuthResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


def build_auth_response(user):
    refresh = RefreshToken.for_user(user)
    return {
        "user": UserSerializer(user).data,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class ProfileBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "date_of_birth", "gender", "preference"]

    def validate_date_of_birth(self, value):
        today = timezone.localdate()
        if value >= today:
            raise serializers.ValidationError("date_of_birth must be in the past.")
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise serializers.ValidationError("You must be 18+ to use Tara.")
        return value


class ProfileBirthSerializer(serializers.ModelSerializer):
    birth_place = serializers.CharField(required=False, allow_blank=True, max_length=255)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    birth_time = serializers.TimeField(required=False, allow_null=True)
    is_default_location = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = ["birth_place", "latitude", "longitude", "birth_time", "is_default_location"]

    def validate(self, attrs):
        has_latitude = "latitude" in attrs
        has_longitude = "longitude" in attrs
        if has_latitude != has_longitude:
            raise serializers.ValidationError("latitude and longitude must be provided together.")
        return attrs

    def validate_latitude(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("longitude must be between -180 and 180.")
        return value

    def update(self, instance, validated_data):
        if "latitude" in validated_data and "longitude" in validated_data:
            instance.latitude = validated_data["latitude"]
            instance.longitude = validated_data["longitude"]

        submitted_place = str(validated_data.get("birth_place", "") or "").strip()
        if submitted_place:
            instance.birth_place = submitted_place
        elif not instance.birth_place:
            instance.birth_place = "Current location"

        if "birth_time" not in validated_data or validated_data.get("birth_time") is None:
            profile_created_time = timezone.localtime(instance.date_joined).time().replace(second=0, microsecond=0)
            instance.birth_time = profile_created_time
            instance.is_birth_time_default = True
        else:
            instance.birth_time = validated_data["birth_time"]
            instance.is_birth_time_default = False

        if "is_default_location" in validated_data:
            instance.is_default_location = bool(validated_data["is_default_location"])

        instance.save(
            update_fields=[
                "birth_place",
                "latitude",
                "longitude",
                "birth_time",
                "is_default_location",
                "is_birth_time_default",
            ]
        )
        return instance


class PersonalityOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalityOption
        fields = ["id", "option_text", "trait_mapping"]


class PersonalityQuestionSerializer(serializers.ModelSerializer):
    options = PersonalityOptionSerializer(many=True, read_only=True)

    class Meta:
        model = PersonalityQuestion
        fields = ["id", "question_text", "category", "is_active", "options"]


class PersonalityResponseInputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()

    def validate(self, attrs):
        try:
            question = PersonalityQuestion.objects.get(id=attrs["question_id"], is_active=True)
        except PersonalityQuestion.DoesNotExist as exc:
            raise serializers.ValidationError({"question_id": "Active question not found."}) from exc

        try:
            option = PersonalityOption.objects.get(id=attrs["option_id"])
        except PersonalityOption.DoesNotExist as exc:
            raise serializers.ValidationError({"option_id": "Option not found."}) from exc

        if option.question_id != question.id:
            raise serializers.ValidationError({"option_id": "Selected option does not belong to this question."})

        attrs["question"] = question
        attrs["selected_option"] = option
        return attrs


class PersonalityResponseSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source="question.id", read_only=True)
    question_text = serializers.CharField(source="question.question_text", read_only=True)
    category = serializers.CharField(source="question.category", read_only=True)
    selected_option = PersonalityOptionSerializer(read_only=True)

    class Meta:
        model = PersonalityResponse
        fields = ["question_id", "question_text", "category", "selected_option"]


class BirthDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "birth_place",
            "latitude",
            "longitude",
            "is_default_location",
            "birth_time",
            "is_birth_time_default",
        ]


class BirthDetailsUpsertSerializer(serializers.ModelSerializer):
    time_of_birth = serializers.TimeField(source="birth_time", required=False, allow_null=True)
    place_of_birth = serializers.CharField(source="birth_place", max_length=255)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    is_default_location = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = [
            "date_of_birth",
            "time_of_birth",
            "place_of_birth",
            "latitude",
            "longitude",
            "is_default_location",
        ]

    def validate_date_of_birth(self, value):
        today = timezone.localdate()
        if value >= today:
            raise serializers.ValidationError("date_of_birth must be in the past.")
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise serializers.ValidationError("You must be 18+ to use Tara.")
        return value

    def validate(self, attrs):
        has_latitude = "latitude" in attrs and attrs.get("latitude") is not None
        has_longitude = "longitude" in attrs and attrs.get("longitude") is not None
        if has_latitude != has_longitude:
            raise serializers.ValidationError("latitude and longitude must be provided together.")

        submitted_place = str(attrs.get("birth_place", "") or "").strip()
        existing_place = str(getattr(self.instance, "birth_place", "") or "").strip()
        place_changed = bool(submitted_place) and submitted_place != existing_place
        if place_changed and not (has_latitude and has_longitude):
            raise serializers.ValidationError(
                {"place_of_birth": "latitude and longitude are required when changing place_of_birth."}
            )
        return attrs

    def validate_latitude(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("longitude must be between -180 and 180.")
        return value

    def update(self, instance, validated_data):
        # `place_of_birth` and `time_of_birth` are mapped via source to model fields.
        birth_time = validated_data.get("birth_time", None)
        is_default_location = validated_data.get("is_default_location", None)
        if validated_data.get("latitude") is None:
            validated_data.pop("latitude", None)
        if validated_data.get("longitude") is None:
            validated_data.pop("longitude", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if is_default_location is not None:
            instance.is_default_location = bool(is_default_location)
        instance.is_birth_time_default = birth_time is None
        instance.save(
            update_fields=[
                "date_of_birth",
                "birth_time",
                "birth_place",
                "latitude",
                "longitude",
                "is_default_location",
                "is_birth_time_default",
            ]
        )
        return instance


class BirthDetailsResponseSerializer(serializers.ModelSerializer):
    time_of_birth = serializers.TimeField(source="birth_time")
    place_of_birth = serializers.CharField(source="birth_place")

    class Meta:
        model = User
        fields = [
            "date_of_birth",
            "time_of_birth",
            "place_of_birth",
            "latitude",
            "longitude",
            "is_default_location",
        ]


class StoredKundaliSerializer(serializers.ModelSerializer):
    planets = serializers.SerializerMethodField()
    houses = serializers.SerializerMethodField()

    class Meta:
        model = KundaliProfile
        fields = [
            "lagna",
            "sun_sign",
            "moon_sign",
            "ascendant_degree",
            "nakshatra",
            "nakshatra_pada",
            "varna",
            "vashya",
            "gana",
            "yoni",
            "nadi",
            "bhakoot",
            "timezone_name",
            "planets",
            "houses",
            "chart_data",
            "is_accurate",
        ]

    def get_planets(self, obj):
        chart_data = obj.chart_data or {}
        planets = chart_data.get("planets")
        if isinstance(planets, dict):
            return planets
        return {}

    def get_houses(self, obj):
        chart_data = obj.chart_data or {}
        houses = chart_data.get("houses")
        if isinstance(houses, dict):
            return houses
        return {}


class KundaliMatchRequestSerializer(serializers.Serializer):
    user1_id = serializers.IntegerField(min_value=1)
    user2_id = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        user1_id = attrs["user1_id"]
        user2_id = attrs["user2_id"]
        if user1_id == user2_id:
            raise serializers.ValidationError("user1_id and user2_id must be different.")

        users = {
            user.id: user
            for user in User.objects.filter(id__in=[user1_id, user2_id]).select_related("kundali_profile")
        }
        user1 = users.get(user1_id)
        user2 = users.get(user2_id)
        if user1 is None:
            raise serializers.ValidationError({"user1_id": "User not found."})
        if user2 is None:
            raise serializers.ValidationError({"user2_id": "User not found."})

        try:
            _ = user1.kundali_profile
        except KundaliProfile.DoesNotExist as exc:
            raise serializers.ValidationError({"user1_id": "Kundali not found for user1."}) from exc
        try:
            _ = user2.kundali_profile
        except KundaliProfile.DoesNotExist as exc:
            raise serializers.ValidationError({"user2_id": "Kundali not found for user2."}) from exc

        attrs["user1"] = user1
        attrs["user2"] = user2
        return attrs


class KundaliMatchResponseSerializer(serializers.Serializer):
    total_score = serializers.IntegerField()
    compatibility = serializers.CharField()
    breakdown = serializers.DictField(child=serializers.IntegerField())


class ProfileMeSerializer(serializers.Serializer):
    basic_info = serializers.SerializerMethodField()
    birth_details = serializers.SerializerMethodField()
    personality_responses = serializers.SerializerMethodField()
    traits = serializers.SerializerMethodField()
    profile_extras = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    def get_basic_info(self, obj):
        return ProfileBasicSerializer(obj).data

    def get_birth_details(self, obj):
        return BirthDetailsSerializer(obj).data

    def get_personality_responses(self, obj):
        responses = obj.personality_responses.select_related("question", "selected_option").order_by("question_id")
        return PersonalityResponseSerializer(responses, many=True).data

    def get_traits(self, obj):
        try:
            profile = Trait.objects.get(user=obj)
        except Trait.DoesNotExist:
            return {}
        return profile.traits or {}

    def get_profile_extras(self, obj):
        return ProfileExtrasSerializer(obj).data

    def get_photos(self, obj):
        images = obj.profile_images.all().order_by("display_order", "id")
        return UserProfileImageSerializer(images, many=True, context=self.context).data

    def get_stats(self, obj):
        match_filter = Q(user_a=obj) | Q(user_b=obj)
        matches_count = Match.objects.filter(
            match_filter,
            status=Match.Status.MATCHED,
            is_visible=True,
        ).count()
        likes_received_count = Swipe.objects.filter(
            target_user=obj,
            action=Swipe.Action.LIKE,
        ).count()
        profile_impressions_count = DailyRecommendation.objects.filter(
            recommended_user=obj,
        ).count()

        return {
            "matches_count": matches_count,
            "likes_received_count": likes_received_count,
            "profile_impressions_count": profile_impressions_count,
        }


class ProfileExtrasSerializer(serializers.ModelSerializer):
    interests = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = User
        fields = ["bio", "interests"]

    def validate_interests(self, value):
        normalized = []
        for item in value:
            text = str(item or "").strip()
            if not text:
                continue
            normalized.append(text)
        unique = list(dict.fromkeys(normalized))
        return unique[:12]


class UserProfileImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfileImage
        fields = ["id", "image_url", "display_order", "created_at"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        raw_url = obj.image.url
        if request is None:
            return raw_url
        return request.build_absolute_uri(raw_url)


class UserProfileImageUploadSerializer(serializers.Serializer):
    image = serializers.FileField()

    def validate_image(self, value):
        content_type = str(getattr(value, "content_type", "") or "").lower()
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError("Only image uploads are allowed.")
        if detect_image_format(value) is None:
            raise serializers.ValidationError("Upload a valid image file.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        with transaction.atomic():
            existing_images = list(
                UserProfileImage.objects.select_for_update()
                .filter(user=user)
                .order_by("display_order", "id")
            )
            if len(existing_images) >= UserProfileImage.MAX_PHOTOS_PER_USER:
                raise serializers.ValidationError(
                    {"image": f"You can upload up to {UserProfileImage.MAX_PHOTOS_PER_USER} photos."}
                )

            next_order = existing_images[-1].display_order + 1 if existing_images else 0
            image = UserProfileImage.objects.create(
                user=user,
                image=validated_data["image"],
                file_token=uuid4().hex,
                display_order=next_order,
            )
        return image


class UserProfileImageReorderSerializer(serializers.Serializer):
    photo_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)

    def validate_photo_ids(self, value):
        ids = [int(item) for item in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("photo_ids must not contain duplicates.")

        user = self.context["request"].user
        current_ids = list(UserProfileImage.objects.filter(user=user).values_list("id", flat=True))
        if set(ids) != set(current_ids):
            raise serializers.ValidationError("photo_ids must include all current profile photo ids exactly once.")
        return ids

    def save(self, **kwargs):
        user = self.context["request"].user
        ids = self.validated_data["photo_ids"]
        with transaction.atomic():
            locked_images = list(
                UserProfileImage.objects.select_for_update()
                .filter(user=user, id__in=ids)
                .order_by("display_order", "id")
            )
            photo_map = {image.id: image for image in locked_images}

            temporary_offset = len(ids)
            for image in locked_images:
                UserProfileImage.objects.filter(id=image.id).update(
                    display_order=image.display_order + temporary_offset
                )

            for order, photo_id in enumerate(ids):
                UserProfileImage.objects.filter(id=photo_id, user=user).update(display_order=order)

        return list(
            UserProfileImage.objects.filter(user=user).order_by("display_order", "id")
        )
