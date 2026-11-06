from django.db import migrations


def backfill_existing_suggestions(apps, schema_editor):
    Match = apps.get_model("matching", "Match")
    Swipe = apps.get_model("matching", "Swipe")
    RecommendationQueue = apps.get_model("matching", "RecommendationQueue")
    db = schema_editor.connection.alias
    legacy_rows = Match.objects.using(db).filter(status__in=["suggested", "liked"], is_visible=True)
    for match in legacy_rows.iterator(chunk_size=500):
        pairs = ((match.user_a_id, match.user_b_id), (match.user_b_id, match.user_a_id))
        for user_id, target_user_id in pairs:
            if Swipe.objects.using(db).filter(user_id=user_id, target_user_id=target_user_id).exists():
                continue
            RecommendationQueue.objects.using(db).get_or_create(
                user_id=user_id,
                target_user_id=target_user_id,
                defaults={
                    "processed": True,
                    "status": "ready",
                    "kundali_score": match.kundali_score,
                    "personality_score": match.personality_score,
                    "final_score": match.final_score,
                    "match_type": match.match_type,
                    "insight_text": match.insight_text,
                },
            )


class Migration(migrations.Migration):
    dependencies = [("matching", "0009_recommendation_generation_queue")]

    operations = [migrations.RunPython(backfill_existing_suggestions, migrations.RunPython.noop)]
