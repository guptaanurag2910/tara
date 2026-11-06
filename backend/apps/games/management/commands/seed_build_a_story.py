from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.story_catalog import QUESTIONS


class Command(BaseCommand):
    help = "Seed the Build a Story game and its curated story starters."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="build_a_story",
                defaults={
                    "name": "Build a Story",
                    "emoji": "📖",
                    "description": "Take turns adding a line to a playful story, then reveal it together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Build a Story",
                defaults={
                    "emoji": "📖",
                    "description": "Five private story turns, revealed together when both players finish.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            for order, row in enumerate(QUESTIONS, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": row["question_text"],
                        "options": [],
                        "tags": row["tags"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(QUESTIONS)).update(is_active=False)

        self.stdout.write(self.style.SUCCESS(f"Build a Story ready: {len(QUESTIONS)} story starters."))
