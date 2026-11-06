from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.caption_this_catalog import SCENES
from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed emoji-illustrated scenes for Caption This."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="caption_this",
                defaults={
                    "name": "Caption This",
                    "emoji": "🎨",
                    "description": "Write a playful caption for a scene and reveal it with your match.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Caption This",
                defaults={
                    "emoji": "🎨",
                    "description": "Write private captions for three playful scenes, then reveal together.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            next_order = (GameQuestion.objects.filter(game=game).order_by("-order").values_list("order", flat=True).first() or 0) + 1
            for scene, emoji in SCENES:
                question = GameQuestion.objects.filter(game=game, question_text=scene).first()
                if question is None:
                    GameQuestion.objects.create(
                        game=game,
                        category=category,
                        game_type=GameQuestion.GameType.OPEN_ENDED,
                        question_text=scene,
                        options=[{"emoji": emoji}],
                        tags=["caption-this", "scene"],
                        order=next_order,
                        is_active=True,
                    )
                    next_order += 1
                else:
                    question.category = category
                    question.game_type = GameQuestion.GameType.OPEN_ENDED
                    question.options = [{"emoji": emoji}]
                    question.tags = ["caption-this", "scene"]
                    question.is_active = True
                    question.save(update_fields=["category", "game_type", "options", "tags", "is_active"])

        total = GameQuestion.objects.filter(game=game, category=category, is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f"Caption This ready: {total} scenes."))
