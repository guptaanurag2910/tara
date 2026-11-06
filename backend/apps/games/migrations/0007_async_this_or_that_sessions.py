from django.db import migrations, models
from django.db.models import Q
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [("games", "0006_game_emoji_gamecategory_emoji")]

    operations = [
        migrations.RemoveConstraint(
            model_name="gamesession",
            name="games_one_active_session_per_match_game",
        ),
        migrations.AlterField(
            model_name="gamesession",
            name="status",
            field=models.CharField(
                choices=[
                    ("invited", "Invited"),
                    ("active", "Active"),
                    ("completed", "Completed"),
                    ("declined", "Declined"),
                    ("expired", "Expired"),
                ],
                db_index=True,
                default="active",
                max_length=16,
            ),
        ),
        migrations.AddConstraint(
            model_name="gamesession",
            constraint=models.UniqueConstraint(
                condition=Q(status__in=["invited", "active"]),
                fields=("match", "game"),
                name="games_one_open_session_per_match_game",
            ),
        ),
        migrations.AlterField(
            model_name="gamesessionquestion",
            name="order",
            field=models.PositiveSmallIntegerField(
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(5),
                ]
            ),
        ),
    ]
