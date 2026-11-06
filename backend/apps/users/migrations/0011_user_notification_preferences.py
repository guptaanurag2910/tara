from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0010_userprofileimage_unique_user_profile_image_order")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notification_preferences",
            field=models.JSONField(blank=True, default=dict, help_text="Per-user in-app notification preferences."),
        ),
    ]
