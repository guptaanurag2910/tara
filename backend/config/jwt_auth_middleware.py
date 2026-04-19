from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework_simplejwt.authentication import JWTAuthentication


@database_sync_to_async
def _resolve_user_from_token(token: str):
    jwt_auth = JWTAuthentication()
    try:
        validated = jwt_auth.get_validated_token(token)
        return jwt_auth.get_user(validated)
    except Exception:
        return AnonymousUser()


class QueryStringJWTAuthMiddleware(BaseMiddleware):
    """
    Allow websocket auth with ?token=<jwt> to support frontend JWT localStorage flows.
    """

    async def __call__(self, scope, receive, send):
        close_old_connections()

        current_user = scope.get("user")
        if current_user is not None and getattr(current_user, "is_authenticated", False):
            return await super().__call__(scope, receive, send)

        query_string = scope.get("query_string", b"")
        params = parse_qs(query_string.decode())
        token = (params.get("token") or [None])[0]
        if token:
            scope["user"] = await _resolve_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)
