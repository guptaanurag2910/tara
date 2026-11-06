from datetime import time

from django.db import migrations


def seed_windows(apps, schema_editor):
    Window = apps.get_model("matching", "GameNightWindow")
    for weekday in (2, 4, 6):
        Window.objects.get_or_create(
            weekday=weekday,
            start_time=time(20, 0),
            timezone_name="Asia/Kolkata",
            defaults={"end_time": time(21, 0), "is_enabled": True},
        )


class Migration(migrations.Migration):
    dependencies = [("matching", "0011_gamenightsession_gamenightreport_gamenightmessage_and_more")]
    operations = [migrations.RunPython(seed_windows, migrations.RunPython.noop)]
