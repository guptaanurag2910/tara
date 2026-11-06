from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.cipher_breaker_catalog import PHRASES, caesar_encrypt
from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed Cipher Breaker and its curated Caesar cipher puzzle bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="cipher_breaker",
                defaults={
                    "name": "Cipher Breaker",
                    "emoji": "🔐",
                    "description": "Decode secret messages with clues and hints.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Cipher Breaker",
                defaults={
                    "emoji": "🔐",
                    "description": "Crack five Caesar ciphers. Guesses stay private until both players finish.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            for order, (answer, hint) in enumerate(PHRASES, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": caesar_encrypt(answer),
                        "options": [{"hint": hint}],
                        "trait_mapping": {"answer": answer},
                        "tags": ["cipher_breaker", "caesar_shift_3"],
                        "difficulty": 1 + (order % 3),
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PHRASES)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Cipher Breaker ready: {len(PHRASES)} active puzzles."))
