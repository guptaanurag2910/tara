from datetime import time

from django.db import migrations


def set_daily_windows(apps, schema_editor):
    Window = apps.get_model("matching", "GameNightWindow")
    windows = list(Window.objects.all())
    original_days = {2, 4, 6}
    is_original_schedule = (
        len(windows) == len(original_days)
        and {window.weekday for window in windows} == original_days
        and all(
            window.start_time == time(20, 0)
            and window.end_time == time(21, 0)
            and window.timezone_name == "Asia/Kolkata"
            and window.is_enabled
            for window in windows
        )
    )
    if not is_original_schedule:
        return

    Window.objects.filter(pk__in=[window.pk for window in windows]).update(
        start_time=time(19, 0), end_time=time(22, 0)
    )
    for weekday in set(range(7)) - original_days:
        Window.objects.create(
            weekday=weekday,
            start_time=time(19, 0),
            end_time=time(22, 0),
            timezone_name="Asia/Kolkata",
            is_enabled=True,
        )


class Migration(migrations.Migration):
    dependencies = [("matching", "0012_default_game_night_windows")]
    operations = [migrations.RunPython(set_daily_windows, migrations.RunPython.noop)]
