from django.urls import path

from .views import ChatMessageListCreateView, MatchMessageCreateView, MatchMessageListView, MatchMessageReactionView

urlpatterns = [
    path("<int:match_id>/messages/", MatchMessageListView.as_view(), name="match-messages"),
    path("<int:match_id>/message/", MatchMessageCreateView.as_view(), name="match-message-create"),
    path("<int:match_id>/messages/<int:message_id>/reaction/", MatchMessageReactionView.as_view(), name="match-message-reaction"),
    path("messages/", ChatMessageListCreateView.as_view(), name="chat-messages"),
]
