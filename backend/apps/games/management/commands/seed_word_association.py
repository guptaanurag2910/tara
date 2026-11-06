from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.word_association_catalog import STARTERS


class Command(BaseCommand):
    help = "Seed Word Association and its starter word bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="word_association",
                defaults={
                    "name": "Word Association",
                    "emoji": "💭",
                    "description": "Take turns adding the first word that comes to mind.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Word Association",
                defaults={
                    "emoji": "💭",
                    "description": "Build one playful word chain together, one turn at a time.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            unique_starters = list(dict.fromkeys(STARTERS))
            for order, starter in enumerate(unique_starters, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": starter,
                        "options": [],
                        "trait_mapping": {},
                        "tags": ["word_association"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(unique_starters)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Word Association ready: {len(unique_starters)} starter words."))
