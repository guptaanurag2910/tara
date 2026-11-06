from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.rank_these_catalog import QUESTIONS


class Command(BaseCommand):
    help = "Seed shared ranking sets for Rank These."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="rank_these",
                defaults={
                    "name": "Rank These",
                    "emoji": "📊",
                    "description": "Independently rank a shared list, then compare your picks together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Rank These",
                defaults={
                    "emoji": "📊",
                    "description": "Rank the same five things privately, then reveal and compare.",
                    "type": Game.Type.CHOICE,
                    "is_active": True,
                },
            )
            for row in QUESTIONS:
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=row["order"],
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": row["question_text"],
                        "options": row["options"],
                        "tags": row["tags"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(QUESTIONS)).update(is_active=False)

        self.stdout.write(self.style.SUCCESS(f"Rank These ready: {len(QUESTIONS)} ranking sets."))
