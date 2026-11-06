from datetime import timedelta

from django.contrib.admin import site
from django.utils import timezone


def admin_dashboard(request):
    """Supply live metrics to Django's admin landing page only."""
    # Avoid dashboard queries on every admin page, including pages that render
    # sensitive individual records.
    if not request.path_info.rstrip("/").endswith("/admin"):
        return {}

    from apps.chat.models import Message
    from apps.games.models import GameSession
    from apps.matching.models import DailyRecommendation, Match, Swipe
    from apps.notifications.models import Notification
    from apps.realtime.models import Match as RealtimeMatch
    from apps.users.models import User

    now = timezone.now()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    active_users = User.objects.filter(last_login__gte=week_ago).count()
    daily_signups = User.objects.filter(date_joined__gte=day_ago).count()
    metrics = [
        {"label": "Total users", "value": User.objects.count(), "detail": f"{daily_signups} joined in the last 24h", "url": "/admin/users/user/"},
        {"label": "Active this week", "value": active_users, "detail": "Users with a recent login", "url": "/admin/users/user/?last_login__gte=" + week_ago.date().isoformat()},
        {"label": "Recommendations", "value": DailyRecommendation.objects.count(), "detail": "Generated recommendation records", "url": "/admin/matching/dailyrecommendation/"},
        {"label": "Matches", "value": Match.objects.filter(status=Match.Status.MATCHED).count(), "detail": "Mutual matches", "url": "/admin/matching/match/"},
        {"label": "Messages", "value": Message.objects.count(), "detail": "Chat activity", "url": "/admin/chat/message/"},
        {"label": "Game sessions", "value": GameSession.objects.count(), "detail": "Conversation games", "url": "/admin/games/gamesession/"},
    ]

    # A compact signup trend for the last seven days.
    signup_trend = []
    for offset in range(6, -1, -1):
        date = (now - timedelta(days=offset)).date()
        count = User.objects.filter(date_joined__date=date).count()
        signup_trend.append({"date": date.strftime("%a"), "count": count})
    peak = max((item["count"] for item in signup_trend), default=0) or 1
    for item in signup_trend:
        item["height"] = max(6, round(item["count"] * 100 / peak))

    return {
        "tara_dashboard": {
            "metrics": metrics,
            "signup_trend": signup_trend,
            "recent_users": User.objects.order_by("-date_joined")[:6],
            "swipes_today": Swipe.objects.filter(updated_at__gte=day_ago).count(),
            "notifications_unread": Notification.objects.filter(is_read=False).count(),
            "realtime_matches": RealtimeMatch.objects.filter(status="matched").count(),
        }
    }
