import logging
import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import KundaliProfile, PersonalityQuestion, PersonalityResponse, UserProfileImage
from .serializers import (
    BirthDetailsResponseSerializer,
    BirthDetailsUpsertSerializer,
    BirthDetailsSerializer,
    ForgotPasswordResetSerializer,
    KundaliMatchRequestSerializer,
    KundaliMatchResponseSerializer,
    LoginSerializer,
    PersonalityQuestionSerializer,
    PersonalityResponseInputSerializer,
    PersonalityResponseSerializer,
    PhoneStatusSerializer,
    ProfileBasicSerializer,
    ProfileBirthSerializer,
    ProfileExtrasSerializer,
    ProfileMeSerializer,
    SignupSerializer,
    StoredKundaliSerializer,
    UserProfileImageReorderSerializer,
    UserProfileImageSerializer,
    UserProfileImageUploadSerializer,
    UserSerializer,
    build_auth_response,
)
from .services.kundali_service import calculate_kundali
from .services.horoscope_service import get_horoscope_for_sign
from .services.matching_service import calculate_user_guna_match
from .services.personality_service import calculate_traits, sync_starter_personality_questions
from .otp_service import send_phone_otp, verify_phone_otp
from .serializers import normalize_phone_number

logger = logging.getLogger(__name__)
User = get_user_model()


def _regenerate_user_kundali(user):
    payload = calculate_kundali(
        date_of_birth=user.date_of_birth,
        birth_time=user.birth_time,
        latitude=user.latitude,
        longitude=user.longitude,
        place_of_birth=user.birth_place,
    )
    resolved = payload.get("resolved_coordinates") if isinstance(payload, dict) else None
    if isinstance(resolved, dict):
        resolved_lat = resolved.get("latitude")
        resolved_lon = resolved.get("longitude")
        if resolved_lat is not None and resolved_lon is not None:
            try:
                user.latitude = resolved_lat
                user.longitude = resolved_lon
                user.save(update_fields=["latitude", "longitude"])
            except Exception:
                logger.exception("Failed to persist resolved coordinates for user_id=%s", user.id)

    defaults = {
        "lagna": payload.get("lagna", ""),
        "sun_sign": payload.get("sun_sign", ""),
        "moon_sign": payload["moon_sign"],
        "ascendant_degree": payload.get("ascendant_degree"),
        "nakshatra": payload["nakshatra"],
        "nakshatra_pada": payload["nakshatra_pada"],
        "varna": payload["varna"],
        "vashya": payload["vashya"],
        "gana": payload["gana"],
        "yoni": payload["yoni"],
        "nadi": payload["nadi"],
        "bhakoot": payload["bhakoot"],
        "timezone_name": payload.get("timezone_name", ""),
        "chart_data": payload.get("chart_data", {}),
        "is_accurate": payload["is_accurate"],
    }
    kundali_obj, _ = KundaliProfile.objects.update_or_create(
        user=user,
        defaults=defaults,
    )
    return kundali_obj


def _sync_astrology_birth_details(user):
    from apps.astrology.models import BirthDetails as AstrologyBirthDetails

    AstrologyBirthDetails.objects.update_or_create(
        user=user,
        defaults={
            "date_of_birth": user.date_of_birth,
            "time_of_birth": user.birth_time,
            "place_of_birth": user.birth_place,
            "latitude": user.latitude,
            "longitude": user.longitude,
            "is_default_location": user.is_default_location,
        },
    )


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "signup"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        try:
            calculate_traits(user)
            _regenerate_user_kundali(user)
        except Exception:
            logger.exception("Failed to initialize trait/kundali profiles for user_id=%s", user.id)
        return Response(build_auth_response(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response(build_auth_response(user), status=status.HTTP_200_OK)


class ForgotPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = ForgotPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset successful."}, status=status.HTTP_200_OK)


class PhoneStatusView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "phone_status"

    def post(self, request):
        serializer = PhoneStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data["phone_number"]
        exists = User.objects.filter(phone_number=phone_number).exists()
        return Response(
            {
                "phone_number": phone_number,
                "exists": exists,
                "next_mode": "login" if exists else "signup",
            },
            status=status.HTTP_200_OK,
        )


class PhoneOtpRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    purpose = serializers.ChoiceField(choices=["signup", "password_reset"])


class PhoneOtpVerifySerializer(PhoneOtpRequestSerializer):
    otp = serializers.CharField(min_length=6, max_length=6)


class PhoneOtpSendView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = PhoneOtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = normalize_phone_number(serializer.validated_data["phone_number"])
        purpose = serializer.validated_data["purpose"]
        exists = User.objects.filter(phone_number=phone).exists()
        if purpose == "signup" and exists:
            raise serializers.ValidationError({"phone_number": "This number already has an account. Log in instead."})
        if purpose == "password_reset" and not exists:
            raise serializers.ValidationError({"phone_number": "No account was found for this number."})
        return Response(send_phone_otp(phone, purpose), status=status.HTTP_200_OK)


class PhoneOtpVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = PhoneOtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = normalize_phone_number(serializer.validated_data["phone_number"])
        verify_phone_otp(phone, serializer.validated_data["purpose"], serializer.validated_data["otp"], consume=False)
        return Response({"verified": True}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data, status=status.HTTP_200_OK)


class ProfileBasicView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ProfileBasicSerializer(instance=request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProfileBirthView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ProfileBirthSerializer(instance=request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        try:
            _regenerate_user_kundali(request.user)
        except Exception:
            logger.exception("Failed to regenerate kundali from profile birth update for user_id=%s", request.user.id)
        return Response(BirthDetailsSerializer(request.user).data, status=status.HTTP_200_OK)


class PersonalityQuestionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sync_starter_personality_questions()
        questions = PersonalityQuestion.objects.filter(is_active=True).prefetch_related("options").order_by("id")
        serializer = PersonalityQuestionSerializer(questions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PersonalityResponseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PersonalityResponseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        response_obj, created = PersonalityResponse.objects.update_or_create(
            user=request.user,
            question=serializer.validated_data["question"],
            defaults={"selected_option": serializer.validated_data["selected_option"]},
        )

        # Example usage: recalculate and persist user traits after each response change.
        calculate_traits(request.user)

        output = PersonalityResponseSerializer(response_obj)
        return Response(
            output.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ProfileMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = ProfileMeSerializer(request.user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProfileExtrasView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = ProfileExtrasSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProfilePhotoListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        photos = UserProfileImage.objects.filter(user=request.user).order_by("display_order", "id")
        serializer = UserProfileImageSerializer(photos, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserProfileImageUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        photo = serializer.save()
        output = UserProfileImageSerializer(photo, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class ProfilePhotoDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, photo_id: int):
        photo = UserProfileImage.objects.filter(user=request.user, id=photo_id).first()
        if photo is None:
            return Response({"detail": "Photo not found."}, status=status.HTTP_404_NOT_FOUND)

        photo.image.delete(save=False)
        photo.delete()

        remaining = UserProfileImage.objects.filter(user=request.user).order_by("display_order", "id")
        for order, image in enumerate(remaining):
            if image.display_order != order:
                image.display_order = order
                image.save(update_fields=["display_order"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfilePhotoReorderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = UserProfileImageReorderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        photos = serializer.save()
        output = UserProfileImageSerializer(photos, many=True, context={"request": request})
        return Response(output.data, status=status.HTTP_200_OK)


class BirthDetailsUpsertView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BirthDetailsUpsertSerializer(instance=request.user, data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                serializer.save()
                kundali_obj = _regenerate_user_kundali(request.user)
                _sync_astrology_birth_details(request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception("Failed to save birth details for user_id=%s", request.user.id)
            return Response(
                {"detail": "Could not save birth details right now."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "birth_details": BirthDetailsResponseSerializer(request.user).data,
                "kundali": StoredKundaliSerializer(kundali_obj).data,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        return self.post(request)


class KundaliDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        kundali_obj = KundaliProfile.objects.filter(user=request.user).first()
        if kundali_obj is None:
            return Response({"detail": "Kundali not found for this user."}, status=status.HTTP_404_NOT_FOUND)

        return Response(StoredKundaliSerializer(kundali_obj).data, status=status.HTTP_200_OK)


class KundaliMatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = KundaliMatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user1 = serializer.validated_data["user1"]
        user2 = serializer.validated_data["user2"]
        payload = calculate_user_guna_match(user1, user2)
        output = KundaliMatchResponseSerializer(payload)
        return Response(output.data, status=status.HTTP_200_OK)


class HoroscopeBySignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, sign: str):
        try:
            payload = get_horoscope_for_sign(sign)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(payload, status=status.HTTP_200_OK)


class PrivacySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    editable_fields = {"profile_visible", "show_age", "show_interests", "show_astrology"}

    def get(self, request):
        saved = request.user.privacy_settings if isinstance(request.user.privacy_settings, dict) else {}
        return Response({
            "profile_visible": saved.get("profile_visible", True),
            "show_age": saved.get("show_age", True),
            "show_interests": saved.get("show_interests", True),
            "show_astrology": saved.get("show_astrology", True),
            "birth_details_private": True,
            "location_precision": "approximate",
        })

    def patch(self, request):
        invalid = set(request.data) - self.editable_fields
        if invalid:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "Only profile visibility, age, interests, and astrology can be changed here."})
        from rest_framework import serializers
        values = serializers.DictField(child=serializers.BooleanField()).run_validation(request.data)
        saved = request.user.privacy_settings if isinstance(request.user.privacy_settings, dict) else {}
        saved.update(values)
        request.user.privacy_settings = saved
        request.user.save(update_fields=["privacy_settings"])
        return self.get(request)


class AccountDataExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        from apps.chat.models import Message
        from apps.astrology.models import BirthDetails
        from apps.games.models import GameResponse, GameSession
        from apps.matching.models import GameNightMessage, GameNightSession, Match, SafetyReport, Swipe
        from apps.notifications.models import Notification
        from apps.users.models import KundaliProfile, PersonalityResponse, Trait
        from django.forms.models import model_to_dict
        matches = Match.objects.filter(Q(user_a=user) | Q(user_b=user)).values("id", "user_a_id", "user_b_id", "status", "created_at")
        messages = Message.objects.filter(match_id__in=Match.objects.filter(Q(user_a=user) | Q(user_b=user)).values("id")).values("id", "match_id", "sender_id", "content", "message_type", "created_at")
        export = {
            "generated_at": timezone.now().isoformat(),
            "profile": {
                "id": user.id, "name": user.name, "email": user.email, "phone_number": user.phone_number,
                "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
                "gender": user.gender, "preference": user.preference, "birth_place": user.birth_place,
                "birth_time": user.birth_time.isoformat() if user.birth_time else None,
                "latitude": str(user.latitude), "longitude": str(user.longitude), "bio": user.bio,
                "interests": user.interests, "privacy_settings": user.privacy_settings,
            },
            "photos": [{"id": photo.id, "url": photo.image.url if photo.image else None, "created_at": photo.created_at.isoformat()} for photo in user.profile_images.all()],
            "personality_responses": list(PersonalityResponse.objects.filter(user=user).values("question_id", "selected_option_id")),
            "trait_profile": (model_to_dict(Trait.objects.filter(user=user).first()) if Trait.objects.filter(user=user).exists() else None),
            "kundali_profile": (model_to_dict(KundaliProfile.objects.filter(user=user).first()) if KundaliProfile.objects.filter(user=user).exists() else None),
            "astrology_birth_details": list(BirthDetails.objects.filter(user=user).values()),
            "matches": list(matches), "conversation_messages": list(messages),
            "game_sessions": list(GameSession.objects.filter(Q(match__user_a=user) | Q(match__user_b=user)).values("id", "match_id", "game_id", "category_id", "status", "created_at")),
            "game_responses": [{"id": row.id, "session_id": row.session_id, "question_id": row.question_id, "answer": row.text_answer, "story_text": row.story_text, "predicted_answer": row.predicted_text_answer, "truth_statements": row.truth_statements, "ranking": row.ranking, "photo_url": row.photo.url if row.photo else None, "photo_caption": row.photo_caption, "created_at": row.created_at.isoformat()} for row in GameResponse.objects.filter(user=user)],
            "notifications": list(Notification.objects.filter(user=user).values("id", "type", "text", "is_read", "created_at")),
            "game_night_sessions": list(GameNightSession.objects.filter(Q(user_a=user) | Q(user_b=user)).values("id", "game_kind", "status", "created_at", "match_id")),
            "game_night_messages": list(GameNightMessage.objects.filter(session__in=GameNightSession.objects.filter(Q(user_a=user) | Q(user_b=user))).values("id", "session_id", "sender_id", "content", "created_at")),
            "swipes": list(Swipe.objects.filter(user=user).values("target_user_id", "action", "created_at")),
            "reports_submitted": list(SafetyReport.objects.filter(reporter=user).values("id", "category", "status", "created_at")),
            "reports_about_me": list(SafetyReport.objects.filter(reported_user=user).values("id", "category", "status", "created_at")),
        }
        response = HttpResponse(json.dumps(export, default=str, ensure_ascii=False), content_type="application/json; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="tara-account-data.json"'
        response["Cache-Control"] = "no-store"
        return response


class AccountDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        if request.data.get("confirmation") != "DELETE":
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"confirmation": "Send confirmation='DELETE' to permanently delete this account."})
        user = request.user
        from apps.games.models import GameResponse
        for photo in user.profile_images.all():
            if photo.image:
                photo.image.delete(save=False)
        for photo_submission in GameResponse.objects.filter(user=user).exclude(photo=""):
            if photo_submission.photo:
                photo_submission.photo.delete(save=False)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
