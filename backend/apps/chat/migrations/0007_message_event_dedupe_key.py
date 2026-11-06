from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("chat", "0006_message_client_message_idempotency")]

    operations = [
        migrations.AddField(
            model_name="message",
            name="event_dedupe_key",
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
        migrations.AddConstraint(
            model_name="message",
            constraint=models.UniqueConstraint(
                fields=("match", "event_dedupe_key"),
                name="chat_event_dedupe_key_unique",
            ),
        ),
    ]
