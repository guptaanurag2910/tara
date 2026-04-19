from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_personality_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="KundaliProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("moon_sign", models.CharField(max_length=100)),
                ("nakshatra", models.CharField(max_length=100)),
                ("nakshatra_pada", models.PositiveSmallIntegerField()),
                ("varna", models.CharField(max_length=100)),
                ("vashya", models.CharField(max_length=100)),
                ("gana", models.CharField(max_length=100)),
                ("yoni", models.CharField(max_length=100)),
                ("nadi", models.CharField(max_length=100)),
                ("bhakoot", models.CharField(max_length=100)),
                ("is_accurate", models.BooleanField(default=False)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="kundali_profile",
                        to="users.user",
                    ),
                ),
            ],
        ),
    ]
