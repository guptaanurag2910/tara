from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0007_user_phone_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="kundaliprofile",
            name="ascendant_degree",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="kundaliprofile",
            name="chart_data",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="kundaliprofile",
            name="lagna",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="kundaliprofile",
            name="sun_sign",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="kundaliprofile",
            name="timezone_name",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
