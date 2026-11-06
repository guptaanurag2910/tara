from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("games", "0007_async_this_or_that_sessions")]

    operations = [
        migrations.AddField(
            model_name="gameresponse",
            name="predicted_text_answer",
            field=models.TextField(blank=True),
        ),
    ]
