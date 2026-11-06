from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("chat", "0005_message_replies_reactions")]

    operations = [
        migrations.AddField(
            model_name="message",
            name="client_message_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name="message",
            constraint=models.UniqueConstraint(
                fields=("match", "sender", "client_message_id"),
                name="chat_msg_client_id_unique",
            ),
        ),
    ]
