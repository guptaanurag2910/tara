from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("games", "0009_build_a_story_text")]

    operations = [
        migrations.AddField(
            model_name="gameresponse",
            name="truth_statements",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="gameresponse",
            name="lie_index",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="gameresponse",
            name="guessed_lie_index",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
