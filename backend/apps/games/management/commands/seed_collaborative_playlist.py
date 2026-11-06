from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.collaborative_playlist_catalog import THEMES
from apps.games.models import Game, GameCategory, GameQuestion


class Command(BaseCommand):
    help = "Seed Collaborative Playlist and its theme prompts."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="collaborative_playlist",
                defaults={
                    "name": "Collaborative Playlist",
                    "emoji": "🎧",
                    "description": "Take turns adding songs to one shared playlist.",
                    "is_active": True,
                },
            )
            game, _ = Game.objects.update_or_create(
                name="Collaborative Playlist",
                defaults={
                    "emoji": "🎧",
                    "description": "Build a themed playlist together, one song at a time.",
                    "type": Game.Type.TEXT,
                    "is_active": True,
                },
            )
            for order, theme in enumerate(THEMES, start=1):
                GameQuestion.objects.update_or_create(
                    game=game,
                    order=order,
                    defaults={
                        "category": category,
                        "game_type": GameQuestion.GameType.OPEN_ENDED,
                        "question_text": theme,
                        "options": [],
                        "trait_mapping": {},
                        "tags": ["collaborative_playlist"],
                        "difficulty": 1,
                        "is_active": True,
                    },
                )
            GameQuestion.objects.filter(game=game, order__gt=len(THEMES)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Collaborative Playlist ready: {len(THEMES)} themes."))
