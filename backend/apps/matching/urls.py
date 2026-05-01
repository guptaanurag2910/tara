from django.urls import path

from .views import (
    DailyRecommendationListView,
    MatchIcebreakerView,
    MatchDetailView,
    MatchListView,
    MatchResultListCreateView,
    RecommendationListView,
    SwipeLikeView,
    SwipePassView,
)

urlpatterns = [
    path("daily-recommendations/", DailyRecommendationListView.as_view(), name="daily-recommendations"),
    path("matches/", MatchListView.as_view(), name="matches-list"),
    path("matches/<int:match_id>/", MatchDetailView.as_view(), name="matches-detail"),
    path("matches/<int:match_id>/icebreakers/", MatchIcebreakerView.as_view(), name="matches-icebreakers"),
    path("results/", MatchResultListCreateView.as_view(), name="match-results"),
    path("recommendations/", RecommendationListView.as_view(), name="match-recommendations"),
    path("swipe/like/", SwipeLikeView.as_view(), name="swipe-like"),
    path("swipe/pass/", SwipePassView.as_view(), name="swipe-pass"),
]
