from django.db import migrations, models


def backfill_message_status(apps, schema_editor):
    Message = apps.get_model("chat", "Message")
    Message.objects.filter(is_read=True).update(status="read")
    Message.objects.filter(is_read=False).update(status="delivered")


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0002_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="status",
            field=models.CharField(
                choices=[("sent", "Sent"), ("delivered", "Delivered"), ("read", "Read")],
                db_index=True,
                default="sent",
                max_length=16,
            ),
        ),
        migrations.RunPython(backfill_message_status, migrations.RunPython.noop),
    ]
