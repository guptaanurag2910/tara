from django.urls import path

from .views import (
    GameListView,
    RespondGameView,
    SessionCurrentQuestionView,
    StartGameSessionView,
    SubmitGameAnswerView,
)

urlpatterns = [
    path("", GameListView.as_view(), name="games-list"),
    path("start/", StartGameSessionView.as_view(), name="games-start"),
    path("session/<int:session_id>/question/", SessionCurrentQuestionView.as_view(), name="games-session-question"),
    path("answer/", SubmitGameAnswerView.as_view(), name="games-answer"),
    path("respond/", RespondGameView.as_view(), name="games-respond"),
]
