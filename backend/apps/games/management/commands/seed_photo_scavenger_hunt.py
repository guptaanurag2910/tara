from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.photo_scavenger_catalog import PROMPTS


class Command(BaseCommand):
    help = "Seed Photo Scavenger Hunt and its prompt bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="photo_scavenger_hunt",
                defaults={
                    "name": "Photo Scavenger Hunt",
                    "emoji": "📸",
                    "description": "Find one moment for a shared photo prompt, then reveal together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Photo Scavenger Hunt",
                defaults={
                    "emoji": "📸",
                    "description": "A low-pressure, asynchronous one-photo chat game.",
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
                        "tags": ["photo_scavenger_hunt"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Photo Scavenger Hunt ready: {len(PROMPTS)} active prompts."))
