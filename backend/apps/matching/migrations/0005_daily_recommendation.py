from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0004_match_matched_at"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DailyRecommendation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "score",
                    models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)]),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "recommended_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recommended_to",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="daily_recommendations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-score", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="dailyrecommendation",
            constraint=models.CheckConstraint(
                check=~models.Q(user=models.F("recommended_user")),
                name="matching_daily_rec_users_must_differ",
            ),
        ),
        migrations.AddConstraint(
            model_name="dailyrecommendation",
            constraint=models.UniqueConstraint(
                fields=("user", "recommended_user"),
                name="matching_daily_rec_unique_pair",
            ),
        ),
        migrations.AddIndex(
            model_name="dailyrecommendation",
            index=models.Index(fields=["user", "-score"], name="matching_daily_rec_user_score_idx"),
        ),
        migrations.AddIndex(
            model_name="dailyrecommendation",
            index=models.Index(fields=["recommended_user"], name="matching_daily_rec_recommended_idx"),
        ),
    ]
