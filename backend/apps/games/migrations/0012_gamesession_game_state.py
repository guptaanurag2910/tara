from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("games", "0011_rank_these_response")]

    operations = [
        migrations.AddField(
            model_name="gamesession",
            name="game_state",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
