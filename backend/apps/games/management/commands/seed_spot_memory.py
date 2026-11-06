from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion
from apps.games.spot_memory_catalog import MEMORY_DECKS, SPOT_SCENES


class Command(BaseCommand):
    help = "Seed database-backed Spot the Difference scenes and Memory Match decks."

    def handle(self, *args, **options):
        with transaction.atomic():
            spot_category, _ = GameCategory.objects.update_or_create(
                slug="spot_the_difference",
                defaults={"name": "Spot the Difference", "emoji": "🔍", "description": "Take turns finding differences in original illustrated scenes.", "is_active": True},
            )
            spot_game, _ = Game.objects.update_or_create(
                name="Spot the Difference",
                defaults={"emoji": "🔍", "description": "Find six differences together, one turn at a time.", "type": Game.Type.CHOICE, "is_active": True},
            )
            for order, scene in enumerate(SPOT_SCENES, start=1):
                GameQuestion.objects.update_or_create(
                    game=spot_game, order=order,
                    defaults={"category": spot_category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                              "question_text": scene["title"], "options": scene,
                              "tags": ["spot-the-difference", scene["scene_id"]], "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=spot_game, order__gt=len(SPOT_SCENES)).update(is_active=False)

            memory_category, _ = GameCategory.objects.update_or_create(
                slug="memory_match",
                defaults={"name": "Memory Match", "emoji": "🃏", "description": "Flip pairs in a shared 4×4 memory board. Match a pair to keep your turn.", "is_active": True},
            )
            memory_game, _ = Game.objects.update_or_create(
                name="Memory Match",
                defaults={"emoji": "🃏", "description": "A shared, saved 4×4 turn-based memory board.", "type": Game.Type.CHOICE, "is_active": True},
            )
            for order, deck in enumerate(MEMORY_DECKS, start=1):
                GameQuestion.objects.update_or_create(
                    game=memory_game, order=order,
                    defaults={"category": memory_category, "game_type": GameQuestion.GameType.OPEN_ENDED,
                              "question_text": deck["title"], "options": deck,
                              "tags": ["memory-match", f"deck-{order}"], "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=memory_game, order__gt=len(MEMORY_DECKS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(
            f"Spot the Difference is ready with {len(SPOT_SCENES)} scenes; Memory Match is ready with {len(MEMORY_DECKS)} decks."
        ))
