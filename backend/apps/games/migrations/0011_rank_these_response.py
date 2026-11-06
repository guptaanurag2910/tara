from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("games", "0010_two_truths_and_lie_response")]

    operations = [
        migrations.AddField(
            model_name="gameresponse",
            name="ranking",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
