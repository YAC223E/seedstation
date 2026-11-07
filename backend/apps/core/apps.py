from __future__ import annotations

import logging

from django.apps import AppConfig
from django.db.backends.signals import connection_created

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"

    def ready(self) -> None:
        connection_created.connect(self.configure_sqlite)

    @staticmethod
    def configure_sqlite(sender, connection, **kwargs) -> None:
        if connection.vendor != "sqlite":
            return
        try:
            with connection.cursor() as cursor:
                cursor.execute("PRAGMA foreign_keys = ON;")
                cursor.execute("PRAGMA busy_timeout = 20000;")
                # WAL is not available for in-memory test databases; it is a
                # useful default for the live single-file database.
                if connection.settings_dict.get("NAME") not in {":memory:", ""}:
                    cursor.execute("PRAGMA journal_mode = WAL;")
                    cursor.execute("PRAGMA synchronous = NORMAL;")
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("SQLite pragma setup skipped: %s", exc)
