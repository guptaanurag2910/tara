from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.secret_song_catalog import PROMPTS


class Command(BaseCommand):
    help = "Seed Secret Song Pick and its conversation prompts."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="secret_song_pick",
                defaults={
                    "name": "Secret Song Pick",
                    "emoji": "🎵",
                    "description": "Pick a song for a playful prompt, then reveal your choices together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Secret Song Pick",
                defaults={
                    "emoji": "🎵",
                    "description": "Choose a song for a prompt and compare your picks after both submit.",
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
                        "options": [],
                        "trait_mapping": {},
                        "tags": ["secret_song_pick"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Secret Song Pick ready: {len(PROMPTS)} prompts."))
