from django.apps import AppConfig


class AstrologyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.astrology"

    def ready(self):
        from . import signals  # noqa: F401
