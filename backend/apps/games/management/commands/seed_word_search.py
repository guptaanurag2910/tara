from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.word_search_catalog import WORDS


class Command(BaseCommand):
    help = "Seed Word Search and its database-backed word bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="word_search",
                defaults={"name": "Word Search", "emoji": "🔎", "description": "Find the hidden words at your own pace, then compare your completed grids.", "is_active": True},
            )
            prompt_category, _ = GameCategory.objects.update_or_create(
                slug="word_search_words",
                defaults={"name": "Word Search Words", "emoji": "🔤", "description": "Words used to build private Word Search puzzles.", "is_active": True},
            )
            game, _ = Game.objects.update_or_create(
                name="Word Search",
                defaults={"emoji": "🔎", "description": "Find the hidden words and compare your progress.", "type": Game.Type.CHOICE, "is_active": True},
            )
            GameQuestion.objects.update_or_create(
                game=game, order=1,
                defaults={"category": category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                          "question_text": "Find the hidden words in the grid!", "options": [],
                          "tags": ["word-search"], "difficulty": 1, "is_active": True},
            )
            bank, _ = Game.objects.update_or_create(
                name="Word Search Word Bank",
                defaults={"emoji": "🔤", "description": "Database-backed Word Search vocabulary.", "type": Game.Type.TEXT, "is_active": True},
            )
            for order, word in enumerate(WORDS, 1):
                GameQuestion.objects.update_or_create(
                    game=bank, order=order,
                    defaults={"category": prompt_category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                              "question_text": word, "options": [], "tags": ["word-search", "word"],
                              "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=bank, order__gt=len(WORDS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Word Search is ready with {len(WORDS)} words."))
