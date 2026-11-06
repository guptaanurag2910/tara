import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.matching.recommendation_service import process_one_recommendation_batch


class Command(BaseCommand):
    help = "Process recommendation generation jobs outside web requests."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process one batch and exit.")
        parser.add_argument("--sleep", type=float, default=2.0, help="Seconds to wait when the queue is empty.")

    def handle(self, *args, **options):
        if options["once"]:
            worked = process_one_recommendation_batch()
            self.stdout.write("Processed one recommendation batch." if worked else "No pending recommendation jobs.")
            return

        idle_sleep = max(0.25, options["sleep"])
        self.stdout.write(self.style.SUCCESS("Recommendation worker started."))
        try:
            while True:
                close_old_connections()
                worked = process_one_recommendation_batch()
                if not worked:
                    time.sleep(idle_sleep)
        except KeyboardInterrupt:
            self.stdout.write("Recommendation worker stopped.")
