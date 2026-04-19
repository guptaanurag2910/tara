from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models
from django.db.models import F, Q
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Match",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "kundali_score",
                    models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(36)]),
                ),
                (
                    "personality_score",
                    models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)]),
                ),
                (
                    "final_score",
                    models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)]),
                ),
                ("match_type", models.CharField(max_length=64)),
                ("insight_text", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("suggested", "Suggested"), ("liked", "Liked"), ("matched", "Matched")],
                        db_index=True,
                        default="suggested",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user_a",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="matches_as_a",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user_b",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="matches_as_b",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
                "indexes": [
                    models.Index(fields=["user_a", "status"], name="matching_u_a_status_idx"),
                    models.Index(fields=["user_b", "status"], name="matching_u_b_status_idx"),
                    models.Index(fields=["status", "-final_score"], name="matching_status_score_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(
                        check=models.Q(("user_a", F("user_b")), _negated=True),
                        name="matching_match_users_must_differ",
                    ),
                    models.CheckConstraint(
                        check=models.Q(("user_a__lt", F("user_b"))),
                        name="matching_match_user_pair_ordered",
                    ),
                    models.UniqueConstraint(fields=("user_a", "user_b"), name="matching_unique_user_pair"),
                ],
            },
        ),
    ]
