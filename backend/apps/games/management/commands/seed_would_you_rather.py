from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.would_you_rather_catalog import PROMPTS


class Command(BaseCommand):
    help = "Add the curated Would You Rather prompt library."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="would_you_rather",
                defaults={
                    "name": "Would You Rather",
                    "emoji": "🤔",
                    "description": "Choose between playful dilemmas and compare your answers together.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Would You Rather",
                defaults={
                    "emoji": "🤔",
                    "description": "Five playful dilemmas, answered privately and revealed together.",
                    "type": Game.Type.CHOICE,
                    "is_active": True,
                },
            )
            next_order = (GameQuestion.objects.filter(game=game).order_by("-order").values_list("order", flat=True).first() or 0) + 1
            for prompt, first, second in PROMPTS:
                question = GameQuestion.objects.filter(game=game, question_text=prompt).first()
                if question is None:
                    question = GameQuestion.objects.create(
                        game=game,
                        category=category,
                        game_type=GameQuestion.GameType.WOULD_YOU_RATHER,
                        question_text=prompt,
                        options=[{"text": first}, {"text": second}],
                        tags=["would-you-rather"],
                        order=next_order,
                        is_active=True,
                    )
                    next_order += 1
                else:
                    question.category = category
                    question.game_type = GameQuestion.GameType.WOULD_YOU_RATHER
                    question.options = [{"text": first}, {"text": second}]
                    question.tags = ["would-you-rather"]
                    question.is_active = True
                    question.save(update_fields=["category", "game_type", "options", "tags", "is_active"])

        total = GameQuestion.objects.filter(game=game, category=category, is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f"Would You Rather ready: {total} prompts."))
