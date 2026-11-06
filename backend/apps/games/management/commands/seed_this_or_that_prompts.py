from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameOption, GameQuestion
from apps.games.seed_catalog import THIS_OR_THAT_EXTRA


class Command(BaseCommand):
    help = "Add the curated This or That prompt library without changing existing questions."

    def handle(self, *args, **options):
        category, _ = GameCategory.objects.update_or_create(
            slug="this_or_that",
            defaults={
                "name": "This or That",
                "emoji": "🎲",
                "description": "Quick, playful choices to start a conversation.",
                "is_active": True,
            },
        )
        game, _ = Game.objects.update_or_create(
            name="This or That",
            defaults={
                "emoji": "🎲",
                "description": "Five fresh choices, picked just for this chat.",
                "type": Game.Type.CHOICE,
                "is_active": True,
            },
        )

        created = 0
        updated = 0
        with transaction.atomic():
            next_order = (GameQuestion.objects.filter(game=game).order_by("-order").values_list("order", flat=True).first() or 0) + 1
            for prompt, left, right, theme in THIS_OR_THAT_EXTRA:
                question = GameQuestion.objects.filter(game=game, question_text=prompt).first()
                if question is None:
                    question = GameQuestion.objects.create(
                        game=game,
                        category=category,
                        game_type=GameQuestion.GameType.THIS_OR_THAT,
                        question_text=prompt,
                        options=[{"text": left}, {"text": right}],
                        tags=[theme],
                        order=next_order,
                        is_active=True,
                    )
                    next_order += 1
                    created += 1
                else:
                    question.category = category
                    question.game_type = GameQuestion.GameType.THIS_OR_THAT
                    question.options = [{"text": left}, {"text": right}]
                    question.tags = [theme]
                    question.is_active = True
                    question.save(update_fields=["category", "game_type", "options", "tags", "is_active"])
                    updated += 1

                for order, text in enumerate((left, right), start=1):
                    GameOption.objects.update_or_create(
                        question=question,
                        order=order,
                        defaults={"option_text": text},
                    )
                GameOption.objects.filter(question=question, order__gt=2).delete()

        total = GameQuestion.objects.filter(game=game, category=category, is_active=True).count()
        self.stdout.write(self.style.SUCCESS("This or That prompt library is ready."))
        self.stdout.write(f"New prompts: {created}; refreshed prompts: {updated}; active total: {total}")
