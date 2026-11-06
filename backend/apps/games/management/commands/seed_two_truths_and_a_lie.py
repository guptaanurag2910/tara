from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.two_truths_lie_catalog import PROMPTS


class Command(BaseCommand):
    help = "Seed Two Truths and a Lie with its prompt bank."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="two_truths_and_a_lie",
                defaults={
                    "name": "Two Truths and a Lie",
                    "emoji": "🕵️",
                    "description": "Share three statements and guess which one is the lie.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Two Truths and a Lie",
                defaults={
                    "emoji": "🕵️",
                    "description": "Each person shares two truths and a lie, then guesses their match's lie.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            for order, prompt in enumerate(PROMPTS, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": prompt,
                        "options": [],
                        "tags": ["icebreaker", "storytelling", "guessing"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)

        self.stdout.write(self.style.SUCCESS(f"Two Truths and a Lie ready: {len(PROMPTS)} prompts."))
