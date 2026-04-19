from django.core.management.base import BaseCommand

from apps.matching.recommendation_service import refresh_daily_recommendations


class Command(BaseCommand):
    help = "Rebuild daily recommendations for all users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--top",
            type=int,
            default=10,
            help="Number of daily recommendations per user (5-10).",
        )

    def handle(self, *args, **options):
        top_n = options["top"]
        result = refresh_daily_recommendations(top_n=top_n)
        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Daily recommendations refreshed: "
                    f"users={result['users_processed']}, "
                    f"created={result['recommendations_created']}, "
                    f"top_n={result['top_n']}"
                )
            )
        )
