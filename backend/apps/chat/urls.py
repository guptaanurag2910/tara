from django.urls import path

from .views import ChatMessageListCreateView, MatchMessageCreateView, MatchMessageListView

urlpatterns = [
    path("<int:match_id>/messages/", MatchMessageListView.as_view(), name="match-messages"),
    path("<int:match_id>/message/", MatchMessageCreateView.as_view(), name="match-message-create"),
    path("messages/", ChatMessageListCreateView.as_view(), name="chat-messages"),
]
