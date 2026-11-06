from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed Tic Tac Toe as a turn-based chat game."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="tic_tac_toe",
                defaults={
                    "name": "Tic Tac Toe",
                    "emoji": "⭕",
                    "description": "Take turns on a shared board. Your game saves between visits.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Tic Tac Toe",
                defaults={
                    "emoji": "⭕",
                    "description": "A quick asynchronous game on a shared 3×3 board.",
                    "type": Game.Type.CHOICE,
                    "is_active": True,
                },
            )
            GameQuestion.objects.update_or_create(
                game=game,
                order=1,
                defaults={
                    "category": category,
                    "game_type": GameQuestion.GameType.OPEN_ENDED,
                    "question_text": "Take turns placing X and O. Get three in a row to win!",
                    "options": [],
                    "tags": ["tic-tac-toe", "turn-based"],
                    "difficulty": 1,
                    "is_active": True,
                },
            )
            GameQuestion.objects.filter(game=game, order__gt=1).update(is_active=False)

        self.stdout.write(self.style.SUCCESS("Tic Tac Toe is ready."))
