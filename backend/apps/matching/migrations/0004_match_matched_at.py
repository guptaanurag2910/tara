from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0003_swipe"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="matched_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
