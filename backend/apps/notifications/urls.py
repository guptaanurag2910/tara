from django.urls import path

from .views import NotificationListView, NotificationMarkReadView, NotificationPreferencesView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("read/", NotificationMarkReadView.as_view(), name="notifications-read"),
    path("preferences/", NotificationPreferencesView.as_view(), name="notifications-preferences"),
]
