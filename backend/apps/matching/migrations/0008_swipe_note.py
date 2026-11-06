from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0007_recommendationqueue_match_is_visible_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="swipe",
            name="note",
            field=models.CharField(blank=True, default="", max_length=280),
        ),
        migrations.AddField(
            model_name="swipe",
            name="note_delivered_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
