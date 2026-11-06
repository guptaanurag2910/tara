from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.word_search_catalog import WORDS


class Command(BaseCommand):
    help = "Seed Unscramble and its database-backed word bank."

    def handle(self, *args, **options):
        words = [word for word in WORDS if len(word) >= 4]
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="unscramble",
                defaults={"name": "Unscramble", "emoji": "🔤", "description": "Solve the same scrambled words privately, then compare your accuracy.", "is_active": True},
            )
            word_category, _ = GameCategory.objects.update_or_create(
                slug="unscramble_words",
                defaults={"name": "Unscramble Words", "emoji": "🧩", "description": "Database-backed words used in Unscramble rounds.", "is_active": True},
            )
            game, _ = Game.objects.update_or_create(
                name="Unscramble",
                defaults={"emoji": "🔤", "description": "Solve scrambled words at your own pace.", "type": Game.Type.CHOICE, "is_active": True},
            )
            GameQuestion.objects.update_or_create(
                game=game, order=1,
                defaults={"category": category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                          "question_text": "Unscramble ten words!", "options": [],
                          "tags": ["unscramble"], "difficulty": 1, "is_active": True},
            )
            bank, _ = Game.objects.update_or_create(
                name="Unscramble Word Bank",
                defaults={"emoji": "🧩", "description": "Words used for Unscramble games.", "type": Game.Type.TEXT, "is_active": True},
            )
            for order, word in enumerate(words, 1):
                GameQuestion.objects.update_or_create(
                    game=bank, order=order,
                    defaults={"category": word_category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                              "question_text": word, "options": [], "tags": ["unscramble", "word"],
                              "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=bank, order__gt=len(words)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Unscramble is ready with {len(words)} words."))
