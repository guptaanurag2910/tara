from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from apps.users.services import calculate_user_guna_match

from .models import DailyRecommendation, Match, MatchResult, Swipe

User = get_user_model()


class MatchResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchResult
        fields = ["id", "partner_name", "score", "reasoning", "created_at"]
        read_only_fields = ["id", "score", "reasoning", "created_at"]


class SwipeInputSerializer(serializers.Serializer):
    target_user_id = serializers.IntegerField()

    def validate(self, attrs):
        request = self.context.get("request")
        if request is None or request.user.is_anonymous:
            raise serializers.ValidationError("Authenticated user is required.")
        target_user_id = attrs["target_user_id"]
        if target_user_id == request.user.id:
            raise serializers.ValidationError({"target_user_id": "You cannot swipe on yourself."})

        target_user = User.objects.filter(id=target_user_id).only("id").first()
        if target_user is None:
            raise serializers.ValidationError({"target_user_id": "Target user not found."})

        attrs["target_user"] = target_user
        return attrs


class SwipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Swipe
        fields = ["id", "user", "target_user", "action", "created_at", "updated_at"]
        read_only_fields = ["id", "user", "created_at", "updated_at"]


class RecommendationSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    compatibility_score = serializers.FloatField(source="final_score", read_only=True)
    insight = serializers.CharField(source="insight_text", read_only=True)

    class Meta:
        model = Match
        fields = ["user_id", "name", "age", "photo", "compatibility_score", "insight"]

    def _counterpart_user(self, obj):
        request = self.context.get("request")
        if request is None or request.user.is_anonymous:
            return obj.user_b
        return obj.user_b if obj.user_a_id == request.user.id else obj.user_a

    def get_user_id(self, obj):
        return self._counterpart_user(obj).id

    def get_name(self, obj):
        return self._counterpart_user(obj).name

    def get_age(self, obj):
        counterpart = self._counterpart_user(obj)
        dob = getattr(counterpart, "date_of_birth", None)
        if dob is None:
            return None

        today = timezone.localdate()
        years = today.year - dob.year
        if (today.month, today.day) < (dob.month, dob.day):
            years -= 1
        return years

    def _photo_value(self, user):
        request = self.context.get("request")

        def with_absolute(raw_url):
            if not raw_url:
                return None
            if request is None:
                return raw_url
            return request.build_absolute_uri(raw_url)

        for attr in ("photo", "profile_photo", "avatar", "image"):
            if not hasattr(user, attr):
                continue
            raw_value = getattr(user, attr)
            if not raw_value:
                continue
            if hasattr(raw_value, "url"):
                return with_absolute(raw_value.url)
            return with_absolute(str(raw_value))
        if hasattr(user, "profile_images"):
            first_photo = user.profile_images.order_by("display_order", "id").first()
            if first_photo and first_photo.image:
                return with_absolute(first_photo.image.url)
        return None

    def get_photo(self, obj):
        return self._photo_value(self._counterpart_user(obj))


class DailyRecommendationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="recommended_user.id", read_only=True)
    name = serializers.CharField(source="recommended_user.name", read_only=True)
    age = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    compatibility_score = serializers.IntegerField(source="score", read_only=True)
    kundali_score = serializers.SerializerMethodField()
    personality_score = serializers.SerializerMethodField()
    insight = serializers.SerializerMethodField()

    class Meta:
        model = DailyRecommendation
        fields = [
            "user_id",
            "name",
            "age",
            "photo",
            "compatibility_score",
            "kundali_score",
            "personality_score",
            "insight",
        ]

    def _photo_value(self, user):
        request = self.context.get("request")

        def with_absolute(raw_url):
            if not raw_url:
                return None
            if request is None:
                return raw_url
            return request.build_absolute_uri(raw_url)

        if hasattr(user, "profile_images"):
            first_photo = user.profile_images.order_by("display_order", "id").first()
            if first_photo and first_photo.image:
                return with_absolute(first_photo.image.url)
        for attr in ("photo", "profile_photo", "avatar", "image"):
            if not hasattr(user, attr):
                continue
            raw_value = getattr(user, attr)
            if not raw_value:
                continue
            if hasattr(raw_value, "url"):
                return with_absolute(raw_value.url)
            return with_absolute(str(raw_value))
        return None

    def _match_for_row(self, obj):
        match_map = self.context.get("daily_match_map") or {}
        return match_map.get(obj.recommended_user_id)

    def get_age(self, obj):
        dob = getattr(obj.recommended_user, "date_of_birth", None)
        if dob is None:
            return None

        today = timezone.localdate()
        years = today.year - dob.year
        if (today.month, today.day) < (dob.month, dob.day):
            years -= 1
        return years

    def get_photo(self, obj):
        return self._photo_value(obj.recommended_user)

    def get_kundali_score(self, obj):
        match = self._match_for_row(obj)
        if match is None:
            return 0
        return int(round(float(match.kundali_score or 0)))

    def get_personality_score(self, obj):
        match = self._match_for_row(obj)
        if match is None:
            return 0
        return int(round(float(match.personality_score or 0)))

    def get_insight(self, obj):
        match = self._match_for_row(obj)
        if match and match.insight_text:
            return match.insight_text
        kundali_score = int(round(float(getattr(match, "kundali_score", 0) or 0)))
        personality_score = int(round(float(getattr(match, "personality_score", 0) or 0)))
        return f"Today's score blends kundali {kundali_score}/36 with personality {personality_score}%."


class MatchListSerializer(serializers.ModelSerializer):
    match_id = serializers.IntegerField(source="id", read_only=True)
    user = serializers.SerializerMethodField()
    compatibility_score = serializers.IntegerField(source="final_score", read_only=True)
    insight = serializers.CharField(source="insight_text", read_only=True)

    class Meta:
        model = Match
        fields = ["match_id", "user", "compatibility_score", "insight"]

    def _counterpart_user(self, obj):
        request = self.context.get("request")
        if request is None or request.user.is_anonymous:
            return obj.user_b
        return obj.user_b if obj.user_a_id == request.user.id else obj.user_a

    def _photo_value(self, user):
        request = self.context.get("request")

        def with_absolute(raw_url):
            if not raw_url:
                return None
            if request is None:
                return raw_url
            return request.build_absolute_uri(raw_url)

        for attr in ("photo", "profile_photo", "avatar", "image"):
            if not hasattr(user, attr):
                continue
            raw_value = getattr(user, attr)
            if not raw_value:
                continue
            if hasattr(raw_value, "url"):
                return with_absolute(raw_value.url)
            return with_absolute(str(raw_value))
        if hasattr(user, "profile_images"):
            first_photo = user.profile_images.order_by("display_order", "id").first()
            if first_photo and first_photo.image:
                return with_absolute(first_photo.image.url)
        return None

    def get_user(self, obj):
        counterpart = self._counterpart_user(obj)
        return {
            "name": counterpart.name,
            "photo": self._photo_value(counterpart),
        }


class MatchDetailSerializer(serializers.ModelSerializer):
    match_id = serializers.IntegerField(source="id", read_only=True)
    user = serializers.SerializerMethodField()
    compatibility_score = serializers.IntegerField(source="final_score", read_only=True)
    insight = serializers.CharField(source="insight_text", read_only=True)
    breakdown = serializers.SerializerMethodField()
    viewer_is_user_a = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            "match_id",
            "user",
            "compatibility_score",
            "kundali_score",
            "personality_score",
            "viewer_is_user_a",
            "breakdown",
            "insight",
            "match_type",
            "status",
            "matched_at",
        ]

    def _counterpart_user(self, obj):
        request = self.context.get("request")
        if request is None or request.user.is_anonymous:
            return obj.user_b
        return obj.user_b if obj.user_a_id == request.user.id else obj.user_a

    def _photo_value(self, user):
        request = self.context.get("request")

        def with_absolute(raw_url):
            if not raw_url:
                return None
            if request is None:
                return raw_url
            return request.build_absolute_uri(raw_url)

        for attr in ("photo", "profile_photo", "avatar", "image"):
            if not hasattr(user, attr):
                continue
            raw_value = getattr(user, attr)
            if not raw_value:
                continue
            if hasattr(raw_value, "url"):
                return with_absolute(raw_value.url)
            return with_absolute(str(raw_value))
        if hasattr(user, "profile_images"):
            first_photo = user.profile_images.order_by("display_order", "id").first()
            if first_photo and first_photo.image:
                return with_absolute(first_photo.image.url)
        return None

    def _age_value(self, user):
        dob = getattr(user, "date_of_birth", None)
        if dob is None:
            return None

        today = timezone.localdate()
        years = today.year - dob.year
        if (today.month, today.day) < (dob.month, dob.day):
            years -= 1
        return years

    def _kundali_attr(self, user, attr_name, fallback=""):
        profile = getattr(user, "kundali_profile", None)
        if profile is None:
            return fallback
        value = getattr(profile, attr_name, fallback)
        return value or fallback

    def get_user(self, obj):
        counterpart = self._counterpart_user(obj)
        return {
            "name": counterpart.name,
            "photo": self._photo_value(counterpart),
            "age": self._age_value(counterpart),
            "sun_sign": self._kundali_attr(counterpart, "sun_sign"),
            "moon_sign": self._kundali_attr(counterpart, "moon_sign"),
            "nakshatra": self._kundali_attr(counterpart, "nakshatra"),
        }

    def get_breakdown(self, obj):
        try:
            payload = calculate_user_guna_match(obj.user_a, obj.user_b)
            return payload.get("breakdown", {})
        except ValueError:
            return {}

    def get_viewer_is_user_a(self, obj):
        request = self.context.get("request")
        if request is None or request.user.is_anonymous:
            return True
        return obj.user_a_id == request.user.id


class IcebreakerResponseSerializer(serializers.Serializer):
    match_id = serializers.IntegerField()
    suggestions = serializers.ListField(child=serializers.CharField())
