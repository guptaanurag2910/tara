from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("games", "0008_guess_their_pick_prediction")]

    operations = [
        migrations.AddField(
            model_name="gameresponse",
            name="story_text",
            field=models.TextField(blank=True),
        ),
    ]
