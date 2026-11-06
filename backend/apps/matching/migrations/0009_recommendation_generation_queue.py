from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("matching", "0008_swipe_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="recommendationqueue",
            name="status",
            field=models.CharField(choices=[("ready", "Ready"), ("shown", "Shown"), ("acted", "Acted")], db_index=True, default="ready", max_length=8),
        ),
        migrations.AddField(model_name="recommendationqueue", name="kundali_score", field=models.FloatField(default=0)),
        migrations.AddField(model_name="recommendationqueue", name="personality_score", field=models.FloatField(default=0)),
        migrations.AddField(model_name="recommendationqueue", name="final_score", field=models.FloatField(default=0)),
        migrations.AddField(model_name="recommendationqueue", name="match_type", field=models.CharField(blank=True, default="", max_length=64)),
        migrations.AddField(model_name="recommendationqueue", name="insight_text", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="recommendationqueue", name="shown_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="recommendationqueue", name="acted_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AlterModelOptions(name="recommendationqueue", options={"ordering": ["-final_score", "id"]}),
        migrations.AddIndex(
            model_name="recommendationqueue",
            index=models.Index(fields=["user", "status", "-final_score", "id"], name="mtch_rq_usr_score_idx"),
        ),
        migrations.CreateModel(
            name="RecommendationGenerationJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pending", "Pending"), ("running", "Running"), ("completed", "Completed"), ("failed", "Failed")], db_index=True, default="pending", max_length=12)),
                ("cursor_id", models.PositiveBigIntegerField(default=0)),
                ("candidates_scanned", models.PositiveIntegerField(default=0)),
                ("initial_target", models.PositiveIntegerField(default=3000)),
                ("batch_size", models.PositiveSmallIntegerField(default=200)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("locked_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="recommendation_generation_job", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name="recommendationgenerationjob",
            index=models.Index(fields=["status", "updated_at"], name="mtch_rgj_stat_upd_idx"),
        ),
    ]
