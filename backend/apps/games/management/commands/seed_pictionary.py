from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.pictionary_catalog import PROMPTS


class Command(BaseCommand):
    help = "Seed Pictionary and its private drawing prompt bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="pictionary",
                defaults={"name": "Pictionary", "emoji": "✏️", "description": "Draw a prompt for your match to guess, then swap roles.", "is_active": True},
            )
            prompt_category, _ = GameCategory.objects.update_or_create(
                slug="pictionary_prompts",
                defaults={"name": "Pictionary Prompts", "emoji": "🖍️", "description": "Private prompts used by Pictionary sessions.", "is_active": True},
            )
            game, _ = Game.objects.update_or_create(
                name="Pictionary",
                defaults={"emoji": "✏️", "description": "Take turns drawing and guessing.", "type": Game.Type.CHOICE, "is_active": True},
            )
            GameQuestion.objects.update_or_create(
                game=game, order=1,
                defaults={"category": category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                          "question_text": "Take turns drawing and guessing!", "options": [],
                          "tags": ["pictionary"], "difficulty": 1, "is_active": True},
            )
            prompt_game, _ = Game.objects.update_or_create(
                name="Pictionary Prompt Bank",
                defaults={"emoji": "🖍️", "description": "Private drawable prompts.", "type": Game.Type.TEXT, "is_active": True},
            )
            for order, prompt in enumerate(PROMPTS, start=1):
                GameQuestion.objects.update_or_create(
                    game=prompt_game, order=order,
                    defaults={"category": prompt_category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                              "question_text": prompt, "options": [], "tags": ["pictionary", "prompt"],
                              "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=prompt_game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Pictionary is ready with {len(PROMPTS)} prompts."))
