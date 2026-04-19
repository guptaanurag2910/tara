from django.conf import settings
from django.db import migrations, models
from django.db.models import F, Q
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0002_match"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Swipe",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("like", "Like"), ("pass", "Pass")], max_length=8)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "target_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="swipes_received",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="swipes_sent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
                "indexes": [
                    models.Index(fields=["user", "action"], name="matching_swipe_user_action_idx"),
                    models.Index(fields=["target_user", "action"], name="matching_swipe_target_action_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(
                        check=models.Q(("user", F("target_user")), _negated=True),
                        name="matching_swipe_users_must_differ",
                    ),
                    models.UniqueConstraint(fields=("user", "target_user"), name="matching_unique_swipe_pair"),
                ],
            },
        ),
    ]
