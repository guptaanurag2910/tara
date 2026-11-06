from django.urls import path

from .game_night_views import (
    GameNightActionView, GameNightMessageView, GameNightQueueView,
    GameNightReportView, GameNightRoomView, GameNightScheduleView, GameNightVoteView,
)

from .views import (
    DailyRecommendationListView,
    MatchIcebreakerView,
    MatchDetailView,
    MatchListView,
    MatchResultListCreateView,
    RecommendationListView,
    RecommendationPreparationView,
    SwipeLikeView,
    SwipePassView,
)
from .safety_views import (
    DatePlanView,
    DateSafetyCheckInView,
    ModerationActionView,
    ModerationAppealsQueueView,
    ModerationAppealReviewView,
    ModerationQueueView,
    MySafetyReportsView,
    MyModerationActionsView,
    SafetyAppealCreateView,
    SafetyBlockView,
    SafetyConnectionActionView,
    SafetyReportCreateView,
)

urlpatterns = [
    path("safety/blocks/", SafetyBlockView.as_view(), name="safety-blocks"),
    path("safety/blocks/<int:user_id>/", SafetyBlockView.as_view(), name="safety-block-delete"),
    path("safety/matches/<int:match_id>/connection/", SafetyConnectionActionView.as_view(), name="safety-match-connection"),
    path("safety/matches/<int:match_id>/date-plan/", DatePlanView.as_view(), name="safety-date-plan"),
    path("safety/matches/<int:match_id>/date-check-in/", DateSafetyCheckInView.as_view(), name="safety-date-check-in"),
    path("safety/reports/", SafetyReportCreateView.as_view(), name="safety-report-create"),
    path("safety/reports/mine/", MySafetyReportsView.as_view(), name="safety-reports-mine"),
    path("safety/moderation/my-actions/", MyModerationActionsView.as_view(), name="safety-my-moderation-actions"),
    path("safety/appeals/<int:action_id>/", SafetyAppealCreateView.as_view(), name="safety-appeal-create"),
    path("safety/moderation/queue/", ModerationQueueView.as_view(), name="safety-moderation-queue"),
    path("safety/moderation/appeals/", ModerationAppealsQueueView.as_view(), name="safety-moderation-appeals"),
    path("safety/moderation/appeals/<int:appeal_id>/review/", ModerationAppealReviewView.as_view(), name="safety-moderation-appeal-review"),
    path("safety/moderation/reports/<int:report_id>/actions/", ModerationActionView.as_view(), name="safety-moderation-action"),
    path("game-night/schedule/", GameNightScheduleView.as_view(), name="game-night-schedule"),
    path("game-night/queue/", GameNightQueueView.as_view(), name="game-night-queue"),
    path("game-night/rooms/<int:room_id>/", GameNightRoomView.as_view(), name="game-night-room"),
    path("game-night/rooms/<int:room_id>/messages/", GameNightMessageView.as_view(), name="game-night-messages"),
    path("game-night/rooms/<int:room_id>/action/", GameNightActionView.as_view(), name="game-night-action"),
    path("game-night/rooms/<int:room_id>/vote/", GameNightVoteView.as_view(), name="game-night-vote"),
    path("game-night/rooms/<int:room_id>/report/", GameNightReportView.as_view(), name="game-night-report"),
    path("daily-recommendations/", DailyRecommendationListView.as_view(), name="daily-recommendations"),
    path("matches/", MatchListView.as_view(), name="matches-list"),
    path("matches/<int:match_id>/", MatchDetailView.as_view(), name="matches-detail"),
    path("matches/<int:match_id>/icebreakers/", MatchIcebreakerView.as_view(), name="matches-icebreakers"),
    path("results/", MatchResultListCreateView.as_view(), name="match-results"),
    path("recommendations/prepare/", RecommendationPreparationView.as_view(), name="match-recommendations-prepare"),
    path("recommendations/", RecommendationListView.as_view(), name="match-recommendations"),
    path("swipe/like/", SwipeLikeView.as_view(), name="swipe-like"),
    path("swipe/pass/", SwipePassView.as_view(), name="swipe-pass"),
]
