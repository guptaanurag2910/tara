from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.chat.models import Message
from apps.games.models import GameSession
from apps.matching.models import Match, RecommendationGenerationJob, RecommendationQueue, Swipe
from apps.notifications.models import Notification
from apps.realtime.models import Match as RealtimeMatch
from apps.users.models import KundaliProfile, Trait
from apps.users.services.matching_service import calculate_guna_match, calculate_personality_match_details

User = get_user_model()


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = request.data.get("password", "")
        user = authenticate(request, email=email, password=password)
        if not user or not user.is_active or not user.is_staff:
            return Response({"detail": "Invalid admin credentials."}, status=status.HTTP_401_UNAUTHORIZED)
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh), "email": user.email})


class AdminOnlyView(APIView):
    permission_classes = [permissions.IsAdminUser]


class AdminOverviewView(AdminOnlyView):
    def get(self, request):
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        return Response({
            "users": User.objects.count(),
            "new_users_today": User.objects.filter(date_joined__gte=day_ago).count(),
            "active_users_week": User.objects.filter(last_login__gte=week_ago).count(),
            "recommendations": RecommendationQueue.objects.count(),
            "matches": Match.objects.filter(status=Match.Status.MATCHED).count(),
            "swipes_today": Swipe.objects.filter(updated_at__gte=day_ago).count(),
            "messages": Message.objects.count(),
            "game_sessions": GameSession.objects.count(),
            "unread_notifications": Notification.objects.filter(is_read=False).count(),
            "realtime_matches": RealtimeMatch.objects.filter(status="matched").count(),
            "signups": [
                {"date": (now - timedelta(days=offset)).date().isoformat(),
                 "count": User.objects.filter(date_joined__date=(now - timedelta(days=offset)).date()).count()}
                for offset in range(6, -1, -1)
            ],
            "recent_users": list(User.objects.order_by("-date_joined").values(
                "id", "name", "email", "gender", "date_joined", "is_active"
            )[:6]),
        })


class AdminUsersView(AdminOnlyView):
    def get(self, request):
        users = User.objects.all().order_by("-date_joined")
        search = request.query_params.get("q", "").strip()
        if search:
            users = users.filter(Q(name__icontains=search) | Q(email__icontains=search) | Q(phone_number__icontains=search))
        total = users.count()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        page_size = 25
        rows = users[(page - 1) * page_size:page * page_size]
        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": [{
                "id": user.id, "name": user.name, "email": user.email,
                "phone_number": user.phone_number, "gender": user.gender,
                "preference": user.preference, "date_of_birth": user.date_of_birth,
                "birth_place": user.birth_place, "birth_time": user.birth_time,
                "date_joined": user.date_joined, "last_login": user.last_login,
                "is_active": user.is_active, "is_staff": user.is_staff,
                "bio": user.bio, "interests": user.interests,
                "photos": [request.build_absolute_uri(photo.image.url) for photo in user.profile_images.all() if photo.image],
                "photo_count": user.profile_images.count(),
                "kundali": _kundali_summary(user),
                "recommendation_count": user.daily_recommendations.count(),
                "match_count": user.matches_as_a.filter(status=Match.Status.MATCHED).count() + user.matches_as_b.filter(status=Match.Status.MATCHED).count(),
            } for user in rows],
        })


def _kundali_summary(user):
    try:
        profile = user.kundali_profile
    except ObjectDoesNotExist:
        return None
    return {
        "sun_sign": profile.sun_sign,
        "moon_sign": profile.moon_sign,
        "lagna": profile.lagna,
        "nakshatra": profile.nakshatra,
        "is_accurate": profile.is_accurate,
    }


class AdminRecommendationsView(AdminOnlyView):
    def get(self, request):
        all_recommendations = RecommendationQueue.objects.all()
        all_jobs = RecommendationGenerationJob.objects.all()
        summary = {
            "total": all_recommendations.count(),
            "ready": all_recommendations.filter(status=RecommendationQueue.Status.READY).count(),
            "shown": all_recommendations.filter(status=RecommendationQueue.Status.SHOWN).count(),
            "acted": all_recommendations.filter(status=RecommendationQueue.Status.ACTED).count(),
            "generation_pending": all_jobs.filter(status=RecommendationGenerationJob.Status.PENDING).count(),
            "generation_running": all_jobs.filter(status=RecommendationGenerationJob.Status.RUNNING).count(),
            "generation_completed": all_jobs.filter(status=RecommendationGenerationJob.Status.COMPLETED).count(),
            "generation_failed": all_jobs.filter(status=RecommendationGenerationJob.Status.FAILED).count(),
        }
        recommendations = RecommendationQueue.objects.select_related("user", "target_user").order_by("-created_at")
        search = request.query_params.get("q", "").strip()
        if search:
            recommendations = recommendations.filter(
                Q(user__name__icontains=search) | Q(user__email__icontains=search)
                | Q(target_user__name__icontains=search) | Q(target_user__email__icontains=search)
            )
        status_filter = request.query_params.get("status", "").strip().lower()
        if status_filter in RecommendationQueue.Status.values:
            recommendations = recommendations.filter(status=status_filter)
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        page_size = 25
        total = recommendations.count()
        rows = list(recommendations[(page - 1) * page_size:page * page_size])
        pair_conditions = Q()
        for row in rows:
            left_id, right_id = sorted((row.user_id, row.target_user_id))
            pair_conditions |= Q(user_a_id=left_id, user_b_id=right_id)
        matches_by_pair = {}
        swipes_by_pair = {}
        if rows:
            matches_by_pair = {
                (match.user_a_id, match.user_b_id): match
                for match in Match.objects.filter(pair_conditions)
            }
            swipes_by_pair = {
                (swipe.user_id, swipe.target_user_id): swipe
                for swipe in Swipe.objects.filter(pair_conditions_for_swipes(rows))
            }
        return Response({
            "count": total, "page": page, "page_size": page_size, "summary": summary,
            "results": [_recommendation_admin_row(row, matches_by_pair, swipes_by_pair) for row in rows],
        })


class AdminRecommendationDetailView(AdminOnlyView):
    def get(self, request, recommendation_id):
        recommendation = get_object_or_404(
            RecommendationQueue.objects.select_related("user", "target_user"),
            pk=recommendation_id,
        )
        user_a = recommendation.user
        user_b = recommendation.target_user
        kundali_a = _optional_related(user_a, "kundali_profile", KundaliProfile)
        kundali_b = _optional_related(user_b, "kundali_profile", KundaliProfile)
        trait_a = _optional_related(user_a, "trait_profile", Trait)
        trait_b = _optional_related(user_b, "trait_profile", Trait)

        kundali_match = {"available": False, "reason": "One or both Kundali profiles are missing."}
        if kundali_a and kundali_b:
            kundali_match = {"available": True, **calculate_guna_match(kundali_a, kundali_b)}

        traits_a = trait_a.traits if trait_a and isinstance(trait_a.traits, dict) else {}
        traits_b = trait_b.traits if trait_b and isinstance(trait_b.traits, dict) else {}
        personality_match = calculate_personality_match_details(traits_a, traits_b)
        personality_match["status"] = (
            "available" if personality_match["available"]
            else "incomplete" if not trait_a or not trait_b or not traits_a or not traits_b
            else "no_shared_traits"
        )

        return Response({
            "id": recommendation.id,
            "created_at": recommendation.created_at,
            "queue_status": recommendation.get_status_display(),
            "lifecycle_status": _recommendation_lifecycle(recommendation),
            "score_snapshot": {
                "overall": recommendation.final_score,
                "kundali": recommendation.kundali_score,
                "personality": recommendation.personality_score,
                "match_type": recommendation.match_type,
                "captured_at": recommendation.created_at,
            },
            "users": [
                _recommendation_user_detail(user_a, kundali_a, traits_a, request),
                _recommendation_user_detail(user_b, kundali_b, traits_b, request),
            ],
            "kundali_match": kundali_match,
            "personality_match": personality_match,
        })


class AdminMatchesView(AdminOnlyView):
    def get(self, request):
        all_matches = Match.objects.all()
        summary = {
            "total": all_matches.count(),
            "matched": all_matches.filter(status=Match.Status.MATCHED).count(),
            "liked": all_matches.filter(status=Match.Status.LIKED).count(),
            "suggested": all_matches.filter(status=Match.Status.SUGGESTED).count(),
            "rejected": all_matches.filter(status=Match.Status.REJECTED).count(),
        }
        matches = Match.objects.select_related("user_a", "user_b").annotate(
            message_count=Count("messages", filter=Q(messages__message_type=Message.MessageType.TEXT)),
            last_message_at=Max("messages__created_at", filter=Q(messages__message_type=Message.MessageType.TEXT)),
        ).order_by("-updated_at")
        search = request.query_params.get("q", "").strip()
        if search:
            matches = matches.filter(
                Q(user_a__name__icontains=search) | Q(user_b__name__icontains=search)
                | Q(user_a__email__icontains=search) | Q(user_b__email__icontains=search)
            )
        status_filter = request.query_params.get("status", "").strip().lower()
        if status_filter in Match.Status.values:
            matches = matches.filter(status=status_filter)
        page, page_size = _page_params(request)
        total = matches.count()
        rows = matches[(page - 1) * page_size:page * page_size]
        return Response({
            "count": total, "page": page, "page_size": page_size,
            "summary": summary,
            "results": [{
                "id": row.id, "member_a": row.user_a.name, "phone_a": row.user_a.phone_number,
                "member_b": row.user_b.name, "phone_b": row.user_b.phone_number,
                "kundali_score": row.kundali_score, "personality_score": row.personality_score,
                "score": row.final_score, "status": row.get_status_display(),
                "match_type": row.match_type, "created_at": row.created_at,
                "matched_at": row.matched_at, "message_count": row.message_count,
                "last_message_at": row.last_message_at,
            } for row in rows],
        })


class AdminSwipesView(AdminOnlyView):
    def get(self, request):
        all_swipes = Swipe.objects.all()
        summary = {
            "total": all_swipes.count(),
            "likes": all_swipes.filter(action=Swipe.Action.LIKE).count(),
            "passes": all_swipes.filter(action=Swipe.Action.PASS).count(),
            "matches": Match.objects.filter(status=Match.Status.MATCHED).count(),
        }
        swipes = Swipe.objects.select_related("user", "target_user").order_by("-updated_at")
        search = request.query_params.get("q", "").strip()
        if search:
            swipes = swipes.filter(
                Q(user__name__icontains=search) | Q(user__email__icontains=search)
                | Q(target_user__name__icontains=search) | Q(target_user__email__icontains=search)
            )
        action_filter = request.query_params.get("status", "").strip().lower()
        if action_filter in Swipe.Action.values:
            swipes = swipes.filter(action=action_filter)
        page, page_size = _page_params(request)
        total = swipes.count()
        rows = list(swipes[(page - 1) * page_size:page * page_size])
        pair_conditions = Q()
        for row in rows:
            left_id, right_id = sorted((row.user_id, row.target_user_id))
            pair_conditions |= Q(user_a_id=left_id, user_b_id=right_id)
        matched_pairs = set()
        if rows:
            matched_pairs = set(
                Match.objects.filter(pair_conditions, status=Match.Status.MATCHED)
                .values_list("user_a_id", "user_b_id")
            )
        return Response({
            "count": total, "page": page, "page_size": page_size, "summary": summary,
            "results": [{
                "id": row.id,
                "user_id": row.user_id, "user_name": row.user.name, "user_email": row.user.email,
                "target_user_id": row.target_user_id, "target_name": row.target_user.name,
                "target_email": row.target_user.email, "action": row.get_action_display(),
                "created_at": row.created_at, "updated_at": row.updated_at,
                "is_mutual_match": tuple(sorted((row.user_id, row.target_user_id))) in matched_pairs,
                "has_note": bool(row.note), "note_delivered_at": row.note_delivered_at,
            } for row in rows],
        })


def pair_conditions_for_swipes(rows):
    conditions = Q()
    for row in rows:
        conditions |= (
            Q(user_id=row.user_id, target_user_id=row.target_user_id)
            | Q(user_id=row.target_user_id, target_user_id=row.user_id)
        )
    return conditions


def _recommendation_admin_row(row, matches_by_pair, swipes_by_pair):
    pair = tuple(sorted((row.user_id, row.target_user_id)))
    match = matches_by_pair.get(pair)
    swipe = swipes_by_pair.get((row.user_id, row.target_user_id))
    if match and match.status == Match.Status.MATCHED:
        lifecycle = "Matched"
    elif swipe:
        lifecycle = swipe.get_action_display()
    else:
        lifecycle = row.get_status_display()
    return {
        "id": row.id,
        "user_id": row.user_id, "user_name": row.user.name, "user_email": row.user.email,
        "target_user_id": row.target_user_id, "recommended_name": row.target_user.name,
        "recommended_email": row.target_user.email,
        "score": row.final_score, "kundali_score": row.kundali_score,
        "personality_score": row.personality_score, "match_type": row.match_type,
        "queue_status": row.get_status_display(), "lifecycle_status": lifecycle,
        "swipe_action": swipe.get_action_display() if swipe else "—",
        "created_at": row.created_at, "shown_at": row.shown_at, "acted_at": row.acted_at,
    }


class AdminConversationsView(AdminOnlyView):
    def get(self, request):
        messages = Message.objects.select_related("sender", "match__user_a", "match__user_b").order_by("-created_at")
        search = request.query_params.get("q", "").strip()
        if search:
            messages = messages.filter(
                Q(sender__name__icontains=search) | Q(sender__email__icontains=search)
                | Q(content__icontains=search) | Q(match__user_a__name__icontains=search)
                | Q(match__user_b__name__icontains=search)
            )
        page, page_size = _page_params(request)
        total = messages.count()
        return Response({
            "count": total, "page": page, "page_size": page_size,
            "results": [{
                "id": row.id, "match_id": row.match_id,
                "participants": f"{row.match.user_a.name} · {row.match.user_b.name}",
                "sender": row.sender.name, "content": row.content,
                "message_type": row.message_type, "status": row.status,
                "created_at": row.created_at,
            } for row in messages[(page - 1) * page_size:page * page_size]],
        })


class AdminGameSessionsView(AdminOnlyView):
    def get(self, request):
        sessions = GameSession.objects.select_related(
            "game", "category", "started_by", "match__user_a", "match__user_b"
        ).order_by("-created_at")
        search = request.query_params.get("q", "").strip()
        if search:
            sessions = sessions.filter(
                Q(game__name__icontains=search) | Q(started_by__name__icontains=search)
                | Q(match__user_a__name__icontains=search) | Q(match__user_b__name__icontains=search)
            )
        page, page_size = _page_params(request)
        total = sessions.count()
        return Response({
            "count": total, "page": page, "page_size": page_size,
            "results": [{
                "id": row.id, "game": row.game.name,
                "category": row.category.name if row.category else "—",
                "participants": f"{row.match.user_a.name} · {row.match.user_b.name}",
                "started_by": row.started_by.name, "status": row.get_status_display(),
                "created_at": row.created_at,
            } for row in sessions[(page - 1) * page_size:page * page_size]],
        })


def _page_params(request):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except ValueError:
        page = 1
    return page, 25


def _optional_related(instance, relation_name, model):
    try:
        value = getattr(instance, relation_name)
    except model.DoesNotExist:
        return None
    return value


def _recommendation_lifecycle(recommendation):
    pair = tuple(sorted((recommendation.user_id, recommendation.target_user_id)))
    match = Match.objects.filter(user_a_id=pair[0], user_b_id=pair[1]).first()
    if match and match.status == Match.Status.MATCHED:
        return "Matched"
    swipe = Swipe.objects.filter(
        user_id=recommendation.user_id,
        target_user_id=recommendation.target_user_id,
    ).first()
    if swipe:
        return swipe.get_action_display()
    return recommendation.get_status_display()


def _recommendation_user_detail(user, kundali, traits, request):
    photos = [
        request.build_absolute_uri(photo.image.url)
        for photo in user.profile_images.all()
        if photo.image
    ]
    kundali_payload = None
    if kundali:
        kundali_payload = {
            "lagna": kundali.lagna,
            "sun_sign": kundali.sun_sign,
            "moon_sign": kundali.moon_sign,
            "ascendant_degree": kundali.ascendant_degree,
            "nakshatra": kundali.nakshatra,
            "nakshatra_pada": kundali.nakshatra_pada,
            "varna": kundali.varna,
            "vashya": kundali.vashya,
            "gana": kundali.gana,
            "yoni": kundali.yoni,
            "nadi": kundali.nadi,
            "bhakoot": kundali.bhakoot,
            "timezone_name": kundali.timezone_name,
            "is_accurate": kundali.is_accurate,
            "chart_data": kundali.chart_data if isinstance(kundali.chart_data, dict) else {},
        }
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "birth_time": user.birth_time,
        "birth_place": user.birth_place,
        "latitude": user.latitude,
        "longitude": user.longitude,
        "bio": user.bio,
        "interests": user.interests if isinstance(user.interests, list) else [],
        "photos": photos,
        "kundali": kundali_payload,
        "personality_traits": traits,
    }
