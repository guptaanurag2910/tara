from django.core.management.base import BaseCommand
from django.db import transaction

from apps.games.models import Game, GameCategory, GameOption, GameQuestion
from apps.games.seed_catalog import SEED_GAMES


class Command(BaseCommand):
    help = "Seed Tara game categories, games, and questions from the curated doc-based catalog."

    def handle(self, *args, **options):
        created_games = 0
        updated_games = 0
        created_questions = 0
        updated_questions = 0
        created_options = 0

        for seed in SEED_GAMES:
            with transaction.atomic():
                category, category_created = GameCategory.objects.update_or_create(
                    slug=seed["slug"],
                    defaults={
                        "name": seed["name"],
                        "emoji": seed.get("emoji", ""),
                        "description": seed.get("description", ""),
                        "is_active": True,
                    },
                )

                game, game_created = Game.objects.update_or_create(
                    name=seed["name"],
                    defaults={
                        "emoji": seed.get("emoji", ""),
                        "description": seed.get("description", ""),
                        "type": seed["type"],
                        "is_active": True,
                    },
                )

                if game_created:
                    created_games += 1
                else:
                    updated_games += 1

                for order, question_seed in enumerate(seed["questions"], start=1):
                    tags = list(question_seed.get("tags", []))
                    source_tag = seed.get("source")
                    if source_tag:
                        tags.append(f"source:{source_tag}")

                    question, question_created = GameQuestion.objects.update_or_create(
                        game=game,
                        order=order,
                        defaults={
                            "category": category,
                            "game_type": seed["question_type"],
                            "question_text": question_seed["question_text"],
                            "options": [{"text": text} for text in question_seed["options"]],
                            "trait_mapping": question_seed.get("trait_mapping", {}),
                            "tags": tags,
                            "difficulty": question_seed.get("difficulty", 1),
                            "is_active": True,
                        },
                    )

                    if question_created:
                        created_questions += 1
                    else:
                        updated_questions += 1

                    existing_options = {
                        option.order: option
                        for option in GameOption.objects.filter(question=question)
                    }

                    for option_order, option_text in enumerate(question_seed["options"], start=1):
                        option = existing_options.get(option_order)
                        if option is None:
                            GameOption.objects.create(
                                question=question,
                                order=option_order,
                                option_text=option_text,
                            )
                            created_options += 1
                            continue

                        if option.option_text != option_text:
                            option.option_text = option_text
                            option.save(update_fields=["option_text"])

                    stale_orders = [
                        option_order
                        for option_order in existing_options
                        if option_order > len(question_seed["options"])
                    ]
                    if stale_orders:
                        GameOption.objects.filter(
                            question=question,
                            order__in=stale_orders,
                        ).delete()

                GameQuestion.objects.filter(
                    game=game,
                    order__gt=len(seed["questions"]),
                ).update(is_active=False)

                if category_created:
                    self.stdout.write(self.style.SUCCESS(f"Created category {category.slug}"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Tara game catalog seeded"))
        self.stdout.write(f"games created: {created_games}")
        self.stdout.write(f"games updated: {updated_games}")
        self.stdout.write(f"questions created: {created_questions}")
        self.stdout.write(f"questions updated: {updated_questions}")
        self.stdout.write(f"options created: {created_options}")
        self.stdout.write(f"catalog entries processed: {len(SEED_GAMES)}")
