from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

from apps.chat.routing import websocket_urlpatterns
from config.jwt_auth_middleware import QueryStringJWTAuthMiddleware

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            QueryStringJWTAuthMiddleware(
                AuthMiddlewareStack(
                    URLRouter(websocket_urlpatterns),
                ),
            )
        ),
    }
)
