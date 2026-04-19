from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from apps.users.services import calculate_user_guna_match

from .models import Match, MatchResult, Swipe

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

    class Meta:
        model = Match
        fields = [
            "match_id",
            "user",
            "compatibility_score",
            "kundali_score",
            "personality_score",
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

    def get_user(self, obj):
        counterpart = self._counterpart_user(obj)
        return {
            "name": counterpart.name,
            "photo": self._photo_value(counterpart),
        }

    def get_breakdown(self, obj):
        try:
            payload = calculate_user_guna_match(obj.user_a, obj.user_b)
            return payload.get("breakdown", {})
        except ValueError:
            return {}


class IcebreakerResponseSerializer(serializers.Serializer):
    match_id = serializers.IntegerField()
    suggestions = serializers.ListField(child=serializers.CharField())
