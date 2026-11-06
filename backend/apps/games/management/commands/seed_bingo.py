from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameQuestion


PROMPTS = [
    ("Ideal lazy Sunday?", "Stay in and recharge|Go out and explore"),
    ("Pick a spontaneous date", "Sunset walk|Late-night dessert"),
    ("Best comfort food?", "Pizza|Noodles"),
    ("Choose a superpower", "Teleportation|Read minds"),
    ("Perfect trip together?", "Beach escape|Mountain cabin"),
    ("Your karaoke pick?", "Pop anthem|Nostalgic classic"),
    ("What makes you laugh?", "Silly jokes|Dry humor"),
    ("Pick a pet sidekick", "Curious cat|Goofy dog"),
    ("A free evening means…", "Try a new place|Rewatch a favorite"),
    ("Choose a tiny adventure", "Take the scenic route|Get happily lost"),
    ("Best breakfast?", "Sweet pancakes|Savory eggs"),
    ("Pick your movie night", "Feel-good comedy|Mystery thriller"),
    ("Travel style?", "Plan every detail|Decide as we go"),
    ("Choose a super snack", "Popcorn|French fries"),
    ("Your ideal playlist?", "Sing-along hits|Chill background"),
    ("First date activity?", "Arcade games|Bookstore browse"),
    ("Better weather?", "Warm and sunny|Cool and rainy"),
    ("Dance floor plan?", "Improvise confidently|Stay near the snacks"),
    ("What would you collect?", "Vinyl records|Postcards"),
    ("Pick a dessert", "Chocolate cake|Fruit tart"),
    ("Your morning style?", "Up early|One more snooze"),
    ("Board game mood?", "Friendly competition|Make up new rules"),
    ("Best city discovery?", "Hidden cafe|Street market"),
    ("Pick a fictional home", "Treehouse|Beach house"),
    ("Your road-trip role?", "DJ|Navigator"),
    ("Rainy-day plan?", "Cook something new|Watch a series"),
    ("Time machine trip?", "Past decades|Future cities"),
    ("Best surprise?", "Thoughtful note|Unplanned outing"),
    ("Choose a team costume", "Matching superheroes|Ridiculous animals"),
    ("A perfect toast?", "Fresh bread|Crispy waffles"),
    ("Pick a weekend skill", "Pottery class|Dance class"),
    ("Choose a tiny luxury", "Breakfast in bed|Fancy coffee"),
    ("Ideal celebration?", "Small dinner|Big party"),
    ("Pick a museum wing", "Space and science|Art and design"),
    ("Choose a fictional companion", "Wise dragon|Loyal robot"),
    ("Best way to get lost?", "In a good book|In a new neighborhood"),
    ("Pick a picnic treat", "Strawberries|Cheese and crackers"),
    ("Choose a silly challenge", "Speak in rhymes|Use a funny accent"),
    ("Ideal cafe table?", "Window seat|Cozy corner"),
    ("Pick a mystery box", "Surprise trip|Surprise meal"),
    ("Better date-night game?", "Trivia showdown|Co-op puzzle"),
    ("Choose a tiny tradition", "Weekly walk|Shared playlist"),
    ("Pick a magical doorway", "A new world|A favorite memory"),
    ("Your cooking style?", "Follow the recipe|Taste and improvise"),
    ("Midnight snack?", "Cereal|Leftover pizza"),
    ("Best surprise talent?", "Great impressions|Unexpected trivia"),
    ("Pick a campsite view", "Lake at sunrise|Stars at night"),
    ("Choose a fun photo", "Goofy faces|Dramatic pose"),
    ("Ideal mini-break?", "Long lunch|Quick walk"),
    ("Pick a shared project", "Build a playlist|Plan a dream trip"),
    ("Choose a victory dance", "Tiny celebration|Full performance"),
    ("Perfect bookstore stop?", "Fiction aisle|Travel section"),
    ("Pick a cozy drink", "Hot chocolate|Chai latte"),
    ("Choose your festival", "Food trucks|Live music"),
    ("Best kind of message?", "A funny meme|A thoughtful check-in"),
    ("Pick a dream class", "Pottery|Cooking"),
    ("Would you explore…", "An old castle|A night market"),
    ("Choose a little dare", "Try karaoke|Try a new food"),
    ("Perfect evening view?", "City lights|Mountain sunset"),
    ("Pick a shared ritual", "Morning coffee|Goodnight voice note"),
    ("Choose a fictional getaway", "A space station|A hidden island"),
]


class Command(BaseCommand):
    help = "Seed Bingo: Are We in Sync? prompts."

    def handle(self, *args, **options):
        with transaction.atomic():
            category, _ = GameCategory.objects.update_or_create(
                slug="bingo",
                defaults={"name": "Bingo: Are We in Sync?", "emoji": "🎯", "description": "Guess your match's answers, earn stamps, and complete a line of five.", "is_active": True},
            )
            game, _ = Game.objects.update_or_create(
                name="Bingo: Are We in Sync?",
                defaults={"emoji": "🎯", "description": "Asynchronous two-player prompt bingo.", "type": Game.Type.CHOICE, "is_active": True},
            )
            for order, (prompt, choices) in enumerate(PROMPTS, start=1):
                GameQuestion.objects.update_or_create(
                    game=game, order=order,
                    defaults={"category": category, "game_type": GameQuestion.GameType.THIS_OR_THAT,
                              "question_text": prompt, "options": [{"text": choice} for choice in choices.split("|")],
                              "tags": ["bingo", "connection"], "difficulty": 1, "is_active": True},
                )
            GameQuestion.objects.filter(game=game, order__gt=len(PROMPTS)).update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f"Bingo is ready with {len(PROMPTS)} prompts."))
