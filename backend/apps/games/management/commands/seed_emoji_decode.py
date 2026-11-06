from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.emoji_decode_catalog import PROMPTS
from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed Emoji Decode and its curated prompt bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="emoji_decode",
                defaults={
                    "name": "Emoji Decode",
                    "emoji": "🧩",
                    "description": "Decode emoji clues and compare private guesses.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Emoji Decode",
                defaults={
                    "emoji": "🧩",
                    "description": "Five emoji clues, private guesses, and a shared reveal.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            for order, (clue, answer) in enumerate(PROMPTS, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": clue,
                        "options": [],
                        "trait_mapping": {"answer": answer},
                        "tags": ["emoji_decode"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Emoji Decode ready: {len(PROMPTS)} active clues."))
