from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.guess_their_pick_catalog import QUESTIONS
from apps.games.models import Game, GameCategory, GameOption, GameQuestion


class Command(BaseCommand):
    help = "Seed the Guess Their Pick game and its curated question bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="guess_their_pick",
                defaults={
                    "name": "Guess Their Pick",
                    "emoji": "🔮",
                    "description": "Pick your answer, predict your match, then reveal together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Guess Their Pick",
                defaults={
                    "emoji": "🔮",
                    "description": "Five private picks and predictions, revealed together.",
                    "type": Game.Type.CHOICE,
                    "is_active": True,
                },
            )

            for order, row in enumerate(QUESTIONS, start=1):
                question, _ = GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.PREDICT_ME,
                        "question_text": row["question_text"],
                        "options": [{"text": text} for text in row["options"]],
                        "tags": row["tags"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
                for option_order, text in enumerate(row["options"], start=1):
                    GameOption.objects.update_or_create(
                        question=question,
                        order=option_order,
                        defaults={"option_text": text},
                    )
                GameOption.objects.filter(question=question, order__gt=len(row["options"])).delete()

            GameQuestion.objects.filter(game=game, order__gt=len(QUESTIONS)).update(is_active=False)

        total = GameQuestion.objects.filter(game=game, category=category, is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f"Guess Their Pick ready: {total} active questions."))
