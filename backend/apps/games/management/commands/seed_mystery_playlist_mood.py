from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.mystery_playlist_mood_catalog import MOODS, PROMPTS


class Command(BaseCommand):
    help = "Seed Mystery Playlist Mood and its mood choices."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="mystery_playlist_mood",
                defaults={
                    "name": "Mystery Playlist Mood",
                    "emoji": "🎶",
                    "description": "Choose a mood privately, then take turns making a playlist for your combined vibe.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Mystery Playlist Mood",
                defaults={
                    "emoji": "🎶",
                    "description": "Reveal both moods, then build a six-song playlist together.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            for order, prompt in enumerate(PROMPTS, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": prompt,
                        "options": [{"text": mood} for mood in MOODS],
                        "trait_mapping": {},
                        "tags": ["mystery_playlist_mood"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Mystery Playlist Mood ready: {len(PROMPTS)} prompts and {len(MOODS)} moods."))
