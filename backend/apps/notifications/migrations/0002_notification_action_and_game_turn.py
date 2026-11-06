from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="action_url",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="notification",
            name="actor_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(choices=[("match", "Match"), ("message", "Message"), ("game_turn", "Game turn"), ("recommendation", "Recommendation")], db_index=True, max_length=20),
        ),
    ]
