from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

from apps.matching.views import (
    DailyRecommendationListView,
    MatchDetailView,
    MatchIcebreakerView,
    MatchListView,
    RecommendationListView,
    SwipeLikeView,
    SwipePassView,
)
from apps.matching.game_night_admin_views import GameNightAdminWindowView, GameNightAdminWindowsView
from config.admin_portal import (
    AdminConversationsView, AdminGameSessionsView, AdminLoginView, AdminMatchesView,
    AdminRecommendationDetailView,
    AdminOverviewView, AdminRecommendationsView, AdminUsersView,
    AdminSwipesView,
)

urlpatterns = [
    path("api/admin-portal/game-night/windows/", GameNightAdminWindowsView.as_view(), name="admin-game-night-windows"),
    path("api/admin-portal/game-night/windows/<int:window_id>/", GameNightAdminWindowView.as_view(), name="admin-game-night-window"),
    path("api/admin-portal/login/", AdminLoginView.as_view(), name="admin-portal-login"),
    path("api/admin-portal/overview/", AdminOverviewView.as_view(), name="admin-portal-overview"),
    path("api/admin-portal/users/", AdminUsersView.as_view(), name="admin-portal-users"),
    path("api/admin-portal/recommendations/", AdminRecommendationsView.as_view(), name="admin-portal-recommendations"),
    path("api/admin-portal/recommendations/<int:recommendation_id>/", AdminRecommendationDetailView.as_view(), name="admin-portal-recommendation-detail"),
    path("api/admin-portal/matches/", AdminMatchesView.as_view(), name="admin-portal-matches"),
    path("api/admin-portal/swipes/", AdminSwipesView.as_view(), name="admin-portal-swipes"),
    path("api/admin-portal/conversations/", AdminConversationsView.as_view(), name="admin-portal-conversations"),
    path("api/admin-portal/games/", AdminGameSessionsView.as_view(), name="admin-portal-games"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.users.urls")),
    path("api/astrology/", include("apps.astrology.urls")),
    path("api/daily-recommendations/", DailyRecommendationListView.as_view(), name="daily-recommendations"),
    path("api/matches/", MatchListView.as_view(), name="matches-list"),
    path("api/matches/<int:match_id>/", MatchDetailView.as_view(), name="matches-detail"),
    path("api/matches/<int:match_id>/icebreakers/", MatchIcebreakerView.as_view(), name="matches-icebreakers"),
    path("api/recommendations/", RecommendationListView.as_view(), name="recommendations"),
    path("api/swipe/like/", SwipeLikeView.as_view(), name="swipe-like"),
    path("api/swipe/pass/", SwipePassView.as_view(), name="swipe-pass"),
    path("api/matching/", include("apps.matching.urls")),
    path("api/chat/", include("apps.chat.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/games/", include("apps.games.urls")),
]

if settings.DEBUG or getattr(settings, "SERVE_MEDIA", False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
