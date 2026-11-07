from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.db import models


def default_download_dir() -> str:
    return str(Path(settings.SEEDSTATION_DOWNLOAD_DIR))


def default_extra_dirs() -> list[str]:
    return list(settings.SEEDSTATION_EXTRA_DIRS)


class AppSettings(models.Model):
    """Single-row application configuration (single-user, self-hosted)."""

    class Theme(models.TextChoices):
        DARK = "dark", "Dark"
        LIGHT = "light", "Light"
        SYSTEM = "system", "System"

    download_dir = models.CharField(max_length=1024, default=default_download_dir)
    extra_dirs = models.JSONField(default=default_extra_dirs, blank=True)
    max_download_speed = models.BigIntegerField(
        default=0, help_text="Global download limit in bytes/s; 0 is unlimited."
    )
    max_upload_speed = models.BigIntegerField(
        default=0, help_text="Global upload limit in bytes/s; 0 is unlimited."
    )
    max_active_downloads = models.PositiveSmallIntegerField(default=3)
    start_paused = models.BooleanField(default=False)
    theme = models.CharField(max_length=16, choices=Theme.choices, default=Theme.DARK)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "SeedStation settings"
        verbose_name_plural = "SeedStation settings"

    def __str__(self) -> str:
        return "SeedStation settings"

    @classmethod
    def get_solo(cls) -> "AppSettings":
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                "download_dir": default_download_dir(),
                "extra_dirs": default_extra_dirs(),
                "theme": cls.Theme.DARK,
            },
        )
        return obj

    @property
    def allowed_dirs(self) -> list[str]:
        values = [self.download_dir, *self.extra_dirs]
        return list(dict.fromkeys(value for value in values if value))


class TelemetrySample(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    engine_online = models.BooleanField(default=True)
    download_speed = models.BigIntegerField(default=0)
    upload_speed = models.BigIntegerField(default=0)
    active_downloads = models.PositiveIntegerField(default=0)
    active_torrents = models.PositiveIntegerField(default=0)
    total_torrents = models.PositiveIntegerField(default=0)
    library_bytes = models.BigIntegerField(default=0)
    storage_used = models.BigIntegerField(default=0)
    storage_free = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["created_at"])]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M:%S} ({self.download_speed} B/s)"


class AuditEvent(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    event = models.CharField(max_length=80)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="seedstation_audit_events",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.event}"
