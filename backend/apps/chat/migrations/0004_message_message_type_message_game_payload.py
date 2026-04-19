from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0003_message_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="game_payload",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="message",
            name="message_type",
            field=models.CharField(
                choices=[("text", "Text"), ("game_event", "Game Event")],
                db_index=True,
                default="text",
                max_length=24,
            ),
        ),
    ]
