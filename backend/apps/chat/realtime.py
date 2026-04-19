import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def safe_group_send(group_name: str, payload: dict) -> bool:
    """
    Best-effort websocket broadcast.

    HTTP APIs should not fail when Redis/channel layer is temporarily unavailable.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return False

    try:
        async_to_sync(channel_layer.group_send)(group_name, payload)
        return True
    except Exception as exc:
        logger.warning("Skipped realtime broadcast for group=%s (%s)", group_name, exc)
        return False
