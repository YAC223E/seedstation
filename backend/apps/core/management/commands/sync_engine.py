from django.core.management.base import BaseCommand, CommandError

from apps.core.models import AppSettings
from apps.torrents.engine import EngineError
from apps.torrents.service import apply_engine_preferences


class Command(BaseCommand):
    help = "Apply SeedStation speed/queue settings to qBittorrent."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit non-zero if qBittorrent is unavailable.",
        )

    def handle(self, *args, **options):
        station = AppSettings.get_solo()
        try:
            apply_engine_preferences(station)
        except EngineError as exc:
            message = f"Could not sync settings with qBittorrent: {exc}"
            if options["strict"]:
                raise CommandError(message) from exc
            self.stderr.write(self.style.WARNING(message))
            return
        self.stdout.write(self.style.SUCCESS("qBittorrent preferences synchronized."))
