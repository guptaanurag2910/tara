from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Game",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(db_index=True, max_length=120)),
                ("description", models.TextField(blank=True)),
                (
                    "type",
                    models.CharField(
                        choices=[("choice", "Choice"), ("text", "Text"), ("quiz", "Quiz")],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "ordering": ["-created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="GameQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_text", models.TextField()),
                ("order", models.PositiveIntegerField()),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="questions",
                        to="games.game",
                    ),
                ),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
        migrations.CreateModel(
            name="GameOption",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("option_text", models.CharField(max_length=255)),
                ("order", models.PositiveIntegerField()),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="options",
                        to="games.gamequestion",
                    ),
                ),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="game",
            index=models.Index(fields=["is_active", "type"], name="games_game_active_type_idx"),
        ),
        migrations.AddConstraint(
            model_name="gamequestion",
            constraint=models.UniqueConstraint(fields=("game", "order"), name="games_unique_question_order_per_game"),
        ),
        migrations.AddIndex(
            model_name="gamequestion",
            index=models.Index(fields=["game", "is_active", "order"], name="games_q_game_active_order_idx"),
        ),
        migrations.AddIndex(
            model_name="gamequestion",
            index=models.Index(fields=["game", "order"], name="games_q_game_order_idx"),
        ),
        migrations.AddConstraint(
            model_name="gameoption",
            constraint=models.UniqueConstraint(
                fields=("question", "order"),
                name="games_unique_option_order_per_question",
            ),
        ),
        migrations.AddIndex(
            model_name="gameoption",
            index=models.Index(fields=["question", "order"], name="games_opt_question_order_idx"),
        ),
    ]
