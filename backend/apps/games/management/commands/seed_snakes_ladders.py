from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion


PROMPTS = [
    ("Ideal lazy Sunday?", "Stay in and recharge|Go out and explore"),
    ("Pick a spontaneous date", "Sunset walk|Late-night dessert"),
    ("Best comfort food?", "Pizza|Noodles"),
    ("Choose a superpower", "Teleportation|Read minds"),
    ("Perfect trip together?", "Beach escape|Mountain cabin"),
    ("Your karaoke pick?", "A pop anthem|A nostalgic classic"),
    ("What makes you laugh?", "Silly jokes|Dry humor"),
    ("Pick a pet sidekick", "A curious cat|A goofy dog"),
    ("A free evening means…", "Try a new place|Rewatch a favorite"),
    ("Choose a tiny adventure", "Miss the train on purpose|Take the scenic route"),
    ("Best breakfast?", "Sweet pancakes|Savory eggs"),
    ("Pick your movie night", "Feel-good comedy|Mystery thriller"),
    ("Would you rather travel…", "With a plan|With no plan"),
    ("Choose a super snack", "Popcorn|French fries"),
    ("Your ideal playlist?", "Sing-along hits|Chill background"),
    ("Pick a first date activity", "Arcade games|Bookstore browse"),
    ("Better weather?", "Warm and sunny|Cool and rainy"),
    ("Choose a dance move", "Confidently improvise|Stay near the snacks"),
    ("What would you collect?", "Vinyl records|Postcards"),
    ("Pick a dessert", "Chocolate cake|Fruit tart"),
    ("Your morning style?", "Up early|One more snooze"),
    ("Choose a board game mood", "Friendly competition|Make up new rules"),
    ("Best city discovery?", "A hidden cafe|A street market"),
    ("Pick a fictional home", "Treehouse|Beach house"),
    ("Your road-trip role?", "DJ|Navigator"),
    ("Choose a rainy-day plan", "Cook something new|Watch a series"),
    ("Pick a time machine trip", "Past decades|Future cities"),
    ("Best kind of surprise?", "A thoughtful note|An unplanned outing"),
    ("Choose your team costume", "Matching superheroes|Ridiculous animals"),
    ("A perfect toast?", "Fresh bread|Crispy waffles"),
    ("Pick a weekend skill", "Pottery class|Dance class"),
    ("Choose a tiny luxury", "Breakfast in bed|Fancy coffee"),
    ("Your ideal celebration?", "Small dinner|Big party"),
    ("Pick a museum wing", "Space and science|Art and design"),
    ("Choose a fictional companion", "A wise dragon|A loyal robot"),
    ("Best way to get lost?", "In a good book|In a new neighborhood"),
    ("Pick a picnic treat", "Strawberries|Cheese and crackers"),
    ("Choose a silly challenge", "Speak in rhymes|Use a funny accent"),
    ("Ideal cafe table?", "Window seat|Cozy corner"),
    ("Pick a mystery box", "A surprise trip|A surprise meal"),
    ("Better date-night game?", "Trivia showdown|Co-op puzzle"),
    ("Choose a tiny tradition", "Weekly walk|Shared playlist"),
    ("Pick a magical doorway", "A new world|A favorite memory"),
    ("Your cooking style?", "Follow the recipe|Taste and improvise"),
    ("Choose a midnight snack", "Cereal|Leftover pizza"),
    ("Best surprise talent?", "Great impressions|Unexpected trivia"),
    ("Pick a campsite view", "Lake at sunrise|Stars at night"),
    ("Choose a fun photo", "Goofy faces|Dramatic pose"),
    ("Your ideal mini-break?", "A long lunch|A quick walk"),
    ("Pick a shared project", "Build a playlist|Plan a dream trip"),
    ("Choose a victory dance", "Tiny celebration|Full performance"),
]


class Command(BaseCommand):
    help = "Seed Snakes, Ladders & Secrets with playful landing-square prompts."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="snakes_ladders",
                defaults={"name": "Snakes, Ladders & Secrets", "emoji": "🐍", "description": "Race to 49, take risky shortcuts, and predict each other's secret picks.", "is_active": True},
            )
            game, _ = Game.objects.update_or_create(
                name="Snakes, Ladders & Secrets",
                defaults={"emoji": "🐍", "description": "A playful 7×7 asynchronous board race.", "type": Game.Type.CHOICE, "is_active": True},
            )
            for index, (prompt, choices) in enumerate(PROMPTS, start=1):
                GameQuestion.objects.update_or_create(
                    game=game, order=index,
                    defaults={"category": category, "game_type": GameQuestion.GameType.THIS_OR_THAT,
                              "question_text": prompt,
                              "options": [{"text": choice} for choice in choices.split("|")],
                              "tags": ["snakes-ladders", "secret-pick"], "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Snakes, Ladders & Secrets is ready with {len(PROMPTS)} secret-pick prompts."))
