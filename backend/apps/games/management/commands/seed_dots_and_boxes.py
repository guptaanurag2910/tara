from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed Dots and Boxes as a turn-based chat game."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="dots_and_boxes",
                defaults={"name": "Dots and Boxes", "emoji": "🔲", "description": "Connect dots, claim boxes, and take another turn when you complete one.", "is_active": True},
            )
            game, _ = Game.objects.update_or_create(
                name="Dots and Boxes",
                defaults={"emoji": "🔲", "description": "A saved, turn-based 3×3 Dots and Boxes board.", "type": Game.Type.CHOICE, "is_active": True},
            )
            GameQuestion.objects.update_or_create(
                game=game, order=1,
                defaults={"category": category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                          "question_text": "Take turns connecting dots. Complete a box to score and play again!",
                          "options": [], "tags": ["dots-and-boxes", "turn-based"],
                          "difficulty": 1, "is_active": True},
            )
            GameQuestion.objects.filter(game=game, order__gt=1).update(is_active=False)
        self.stdout.write(self.style.SUCCESS("Dots and Boxes is ready."))
