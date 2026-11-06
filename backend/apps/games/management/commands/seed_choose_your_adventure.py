from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.choose_adventure_catalog import QUESTIONS
from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed Choose Your Adventure with branching five-step stories."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="choose_your_adventure",
                defaults={
                    "name": "Choose Your Adventure",
                    "emoji": "🗺️",
                    "description": "Make private choices through a short story, then reveal your paths together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Choose Your Adventure",
                defaults={
                    "emoji": "🗺️",
                    "description": "Five choices shape your adventure and ending.",
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
                        "game_type": GameQuestion.GameType.THIS_OR_THAT,
                        "question_text": row["question_text"],
                        "options": row["options"],
                        "tags": row["tags"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(QUESTIONS)).update(is_active=False)

        self.stdout.write(self.style.SUCCESS(f"Choose Your Adventure ready: {len(QUESTIONS)} story stages."))
