from django.urls import path

from .views import (
    GameListView,
    PhotoScavengerPhotoView,
    PhotoScavengerUploadView,
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
    path("session/<int:session_id>/photo/", PhotoScavengerUploadView.as_view(), name="games-photo-scavenger-upload"),
    path("session/<int:session_id>/photo/reveal/", PhotoScavengerPhotoView.as_view(), name="games-photo-scavenger-photo"),
]
