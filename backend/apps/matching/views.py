import logging

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.services.matching.icebreaker_service import generate_icebreakers
from apps.services.matching.service import generate_match_score
from apps.services.utils.pagination import StandardResultsSetPagination

from .models import DailyRecommendation, Match, MatchResult, Swipe
from .recommendation_service import ensure_daily_recommendations_for_user, get_recommendations_for_user
from .serializers import (
    DailyRecommendationSerializer,
    IcebreakerResponseSerializer,
    MatchDetailSerializer,
    MatchListSerializer,
    MatchResultSerializer,
    RecommendationSerializer,
    SwipeInputSerializer,
)
from .swipe_service import handle_swipe

logger = logging.getLogger(__name__)


class RecommendationPagination(StandardResultsSetPagination):
    page_size = 20
    page_size_query_param = None


class MatchResultListCreateView(generics.ListCreateAPIView):
    serializer_class = MatchResultSerializer

    def get_queryset(self):
        return MatchResult.objects.filter(user=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        data = serializer.validated_data
        score, reasoning = generate_match_score(self.request.user, data["partner_name"])
        serializer.save(user=self.request.user, score=score, reasoning=reasoning)


class RecommendationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RecommendationSerializer
    pagination_class = RecommendationPagination

    def get_queryset(self):
        user = self.request.user
        try:
            # Ensure recommendations are generated before listing.
            get_recommendations_for_user(user.id, limit=50, use_cache=True)
        except Exception:
            logger.exception("Failed to build recommendations for user_id=%s", user.id)

        swiped_target_ids = Swipe.objects.filter(user=user).values_list("target_user_id", flat=True)

        return (
            Match.objects.filter(
                status__in=[Match.Status.SUGGESTED, Match.Status.LIKED],
                is_visible=True,
            )
            .filter(Q(user_a=user) | Q(user_b=user))
            .exclude(
                Q(user_a=user, user_b_id__in=swiped_target_ids)
                | Q(user_b=user, user_a_id__in=swiped_target_ids)
            )
            .select_related("user_a", "user_b")
            .prefetch_related("user_a__profile_images", "user_b__profile_images")
            .order_by("-final_score", "-id")
        )


class DailyRecommendationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyRecommendationSerializer
    pagination_class = RecommendationPagination

    def get_queryset(self):
        daily_rows = ensure_daily_recommendations_for_user(self.request.user.id, top_n=5)
        self._daily_rows = daily_rows
        recommended_ids = [row.recommended_user_id for row in daily_rows]
        match_map = {}
        if recommended_ids:
            matches = Match.objects.filter(
                Q(user_a=self.request.user, user_b_id__in=recommended_ids)
                | Q(user_b=self.request.user, user_a_id__in=recommended_ids)
            ).select_related("user_a", "user_b")
            for match in matches:
                other_user_id = match.user_b_id if match.user_a_id == self.request.user.id else match.user_a_id
                match_map[other_user_id] = match
        self._daily_match_map = match_map
        row_ids = [row.id for row in daily_rows]
        return (
            DailyRecommendation.objects.filter(id__in=row_ids)
            .select_related("recommended_user")
            .prefetch_related("recommended_user__profile_images")
            .order_by("-score", "id")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["daily_match_map"] = getattr(self, "_daily_match_map", {})
        return context


class MatchListView(generics.ListAPIView):
    serializer_class = MatchListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Match.objects.filter(status=Match.Status.MATCHED)
            .filter(Q(user_a=self.request.user) | Q(user_b=self.request.user))
            .select_related("user_a", "user_b")
            .prefetch_related("user_a__profile_images", "user_b__profile_images")
            .order_by("-matched_at", "-updated_at")
        )


class MatchDetailView(generics.RetrieveAPIView):
    serializer_class = MatchDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "match_id"

    def get_queryset(self):
        return (
            Match.objects.filter(status=Match.Status.MATCHED)
            .filter(Q(user_a=self.request.user) | Q(user_b=self.request.user))
            .select_related("user_a", "user_b", "user_a__kundali_profile", "user_b__kundali_profile")
            .prefetch_related("user_a__profile_images", "user_b__profile_images")
        )


class MatchIcebreakerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id: int):
        match = get_object_or_404(
            Match.objects.filter(status=Match.Status.MATCHED)
            .filter(Q(user_a=request.user) | Q(user_b=request.user))
            .select_related("user_a", "user_b")
            .prefetch_related("user_a__profile_images", "user_b__profile_images"),
            id=match_id,
        )

        payload = {
            "match_id": match.id,
            "suggestions": generate_icebreakers(match),
        }
        serializer = IcebreakerResponseSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SwipeLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SwipeInputSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        target_user = serializer.validated_data["target_user"]
        payload = handle_swipe(request.user, target_user, Swipe.Action.LIKE)
        return Response(payload, status=status.HTTP_200_OK)


class SwipePassView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SwipeInputSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        target_user = serializer.validated_data["target_user"]
        payload = handle_swipe(request.user, target_user, Swipe.Action.PASS)
        return Response(payload, status=status.HTTP_200_OK)
