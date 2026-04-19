from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0001_initial"),
        ("matching", "0005_daily_recommendation"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GameSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("current_question_index", models.PositiveIntegerField(default=0)),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("completed", "Completed")],
                        db_index=True,
                        default="active",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="games.game",
                    ),
                ),
                (
                    "match",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="game_sessions",
                        to="matching.match",
                    ),
                ),
                (
                    "started_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="started_game_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="GameResponse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text_answer", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="responses",
                        to="games.gamequestion",
                    ),
                ),
                (
                    "selected_option",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="responses",
                        to="games.gameoption",
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="responses",
                        to="games.gamesession",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="game_responses",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="gamesession",
            constraint=models.UniqueConstraint(
                condition=models.Q(status="active"),
                fields=("match", "game"),
                name="games_one_active_session_per_match_game",
            ),
        ),
        migrations.AddIndex(
            model_name="gamesession",
            index=models.Index(fields=["match", "status"], name="games_session_match_status_idx"),
        ),
        migrations.AddIndex(
            model_name="gamesession",
            index=models.Index(fields=["game", "status"], name="games_session_game_status_idx"),
        ),
        migrations.AddConstraint(
            model_name="gameresponse",
            constraint=models.UniqueConstraint(
                fields=("session", "user", "question"),
                name="games_unique_response_per_user_question_in_session",
            ),
        ),
        migrations.AddIndex(
            model_name="gameresponse",
            index=models.Index(fields=["session", "question"], name="games_resp_session_question_idx"),
        ),
        migrations.AddIndex(
            model_name="gameresponse",
            index=models.Index(fields=["session", "user"], name="games_resp_session_user_idx"),
        ),
    ]
