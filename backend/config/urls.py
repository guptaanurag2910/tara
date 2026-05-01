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

urlpatterns = [
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
