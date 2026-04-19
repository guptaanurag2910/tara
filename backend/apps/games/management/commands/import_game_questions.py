from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.games.models import Game
from apps.games.question_import_service import (
    import_game_questions_rows,
    load_rows_from_json_path,
)


class Command(BaseCommand):
    help = "Import game questions from a JSON file."

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str, help="Path to JSON file.")
        parser.add_argument(
            "--game-name",
            default="Imported Questions",
            help="Game name used to attach imported questions.",
        )
        parser.add_argument(
            "--game-type",
            choices=[choice for choice, _ in Game.Type.choices],
            default=Game.Type.CHOICE,
            help="Game type used when creating the import game.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and print summary without creating records.",
        )

    def handle(self, *args, **cmd_options):
        file_path = Path(cmd_options["file_path"]).expanduser().resolve()
        if not file_path.exists():
            raise CommandError(f"File not found: {file_path}")
        if not file_path.is_file():
            raise CommandError(f"Not a file: {file_path}")
        if file_path.suffix.lower() != ".json":
            raise CommandError("Only JSON files are supported. Use a .json file.")

        try:
            rows = load_rows_from_json_path(file_path)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        except Exception as exc:
            raise CommandError(f"Invalid JSON in {file_path}: {exc}") from exc

        summary = import_game_questions_rows(
            rows,
            game_name=cmd_options["game_name"],
            game_type=cmd_options["game_type"],
            dry_run=cmd_options["dry_run"],
        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Import summary"))
        self.stdout.write(f"created: {summary['created']}")
        self.stdout.write(f"skipped: {summary['skipped']}")
        self.stdout.write(f"errors: {summary['errors']}")
        self.stdout.write(f"total_processed: {summary['total_processed']}")
        if summary["error_details"]:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Error details:"))
            for detail in summary["error_details"]:
                self.stdout.write(self.style.ERROR(f"- {detail}"))
