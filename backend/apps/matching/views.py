import logging

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.services.matching.icebreaker_service import generate_icebreakers
from apps.services.matching.service import generate_match_score
from apps.realtime.models import Match as RealtimeMatch
from apps.services.utils.pagination import StandardResultsSetPagination

from .models import DailyRecommendation, Match, MatchResult, RecommendationQueue, Swipe, UserBlock
from .recommendation_service import enqueue_recommendations_for_user, ensure_daily_recommendations_for_user
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
        swiped_target_ids = Swipe.objects.filter(user=user).values_list("target_user_id", flat=True)
        matched_target_ids = Match.objects.filter(
            status=Match.Status.MATCHED, user_a=user
        ).values_list("user_b_id", flat=True)
        reverse_matched_ids = Match.objects.filter(
            status=Match.Status.MATCHED, user_b=user
        ).values_list("user_a_id", flat=True)
        blocked_target_ids = RealtimeMatch.objects.filter(
            status=RealtimeMatch.Status.BLOCKED, user_a=user
        ).values_list("user_b_id", flat=True)
        reverse_blocked_ids = RealtimeMatch.objects.filter(
            status=RealtimeMatch.Status.BLOCKED, user_b=user
        ).values_list("user_a_id", flat=True)
        blocked_by_user_ids = UserBlock.objects.filter(blocker=user).values_list("blocked_user_id", flat=True)
        blocking_user_ids = UserBlock.objects.filter(blocked_user=user).values_list("blocker_id", flat=True)
        return (
            RecommendationQueue.objects.filter(
                user=user,
                status__in=[RecommendationQueue.Status.READY, RecommendationQueue.Status.SHOWN],
                target_user__is_active=True,
            )
            .filter(Q(target_user__privacy_settings__profile_visible=True) | Q(target_user__privacy_settings__profile_visible__isnull=True))
            .exclude(target_user_id__in=swiped_target_ids)
            .exclude(target_user_id__in=matched_target_ids)
            .exclude(target_user_id__in=reverse_matched_ids)
            .exclude(target_user_id__in=blocked_target_ids)
            .exclude(target_user_id__in=reverse_blocked_ids)
            .exclude(target_user_id__in=blocked_by_user_ids)
            .exclude(target_user_id__in=blocking_user_ids)
            .select_related("target_user", "target_user__kundali_profile")
            .select_related("target_user__trait_profile")
            .prefetch_related("target_user__profile_images")
            .order_by("-final_score", "id")
        )

    def list(self, request, *args, **kwargs):
        job = enqueue_recommendations_for_user(request.user.id)
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        rows = page if page is not None else queryset
        serializer = self.get_serializer(rows, many=True)
        row_ids = [row.id for row in rows]
        if row_ids:
            RecommendationQueue.objects.filter(
                id__in=row_ids, status=RecommendationQueue.Status.READY
            ).update(status=RecommendationQueue.Status.SHOWN, shown_at=timezone.now())
        if page is not None:
            response = self.get_paginated_response(serializer.data)
        else:
            response = Response(serializer.data)
        response.data = {
            **(response.data if isinstance(response.data, dict) else {"results": response.data}),
            "generation_status": job.status if job else "unavailable",
            "ready_count": queryset.count(),
        }
        return response


class RecommendationPreparationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        job = enqueue_recommendations_for_user(request.user.id, retry_failed=True)
        if job is None:
            return Response({"detail": "Recommendation generation is unavailable for this account."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "generation_status": job.status,
            "candidates_scanned": job.candidates_scanned,
            "initial_target": job.initial_target,
        }, status=status.HTTP_202_ACCEPTED)


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
            queue_rows = RecommendationQueue.objects.filter(
                user=self.request.user, target_user_id__in=recommended_ids
            )
            for queue_row in queue_rows:
                match_map.setdefault(queue_row.target_user_id, queue_row)
        self._daily_match_map = match_map
        row_ids = [row.id for row in daily_rows]
        return (
            DailyRecommendation.objects.filter(id__in=row_ids)
            .filter(Q(recommended_user__privacy_settings__profile_visible=True) | Q(recommended_user__privacy_settings__profile_visible__isnull=True))
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
        try:
            payload = handle_swipe(request.user, target_user, Swipe.Action.LIKE, note=serializer.validated_data.get("note", ""))
        except ValueError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        return Response(payload, status=status.HTTP_200_OK)


class SwipePassView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SwipeInputSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        target_user = serializer.validated_data["target_user"]
        try:
            payload = handle_swipe(request.user, target_user, Swipe.Action.PASS)
        except ValueError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        return Response(payload, status=status.HTTP_200_OK)
