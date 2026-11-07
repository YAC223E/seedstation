from __future__ import annotations

import os
from pathlib import Path

from rest_framework import serializers

from .models import AppSettings
from .paths import PathGuardError, validate_configured_directory


class AppSettingsSerializer(serializers.ModelSerializer):
    extra_dirs = serializers.ListField(
        child=serializers.CharField(max_length=1024, allow_blank=False),
        required=False,
        max_length=8,
    )

    class Meta:
        model = AppSettings
        fields = [
            "download_dir",
            "extra_dirs",
            "max_download_speed",
            "max_upload_speed",
            "max_active_downloads",
            "start_paused",
            "theme",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_download_dir(self, value: str) -> str:
        try:
            return str(validate_configured_directory(value))
        except PathGuardError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_max_download_speed(self, value: int) -> int:
        if value < 0 or value > 1_000_000_000:
            raise serializers.ValidationError("Use a limit between 0 and 1 GB/s.")
        return value

    def validate_max_upload_speed(self, value: int) -> int:
        if value < 0 or value > 1_000_000_000:
            raise serializers.ValidationError("Use a limit between 0 and 1 GB/s.")
        return value

    def validate_max_active_downloads(self, value: int) -> int:
        if value < 1 or value > 50:
            raise serializers.ValidationError("Choose between 1 and 50 active downloads.")
        return value

    def validate(self, attrs):
        instance = self.instance
        primary = attrs.get("download_dir", getattr(instance, "download_dir", ""))
        extra = attrs.get("extra_dirs", getattr(instance, "extra_dirs", []))
        cleaned: list[str] = []
        seen = set()
        for item in extra:
            try:
                resolved = str(validate_configured_directory(item))
            except PathGuardError as exc:
                raise serializers.ValidationError({"extra_dirs": str(exc)}) from exc
            if resolved == primary:
                raise serializers.ValidationError(
                    {"extra_dirs": "The primary download directory is already included."}
                )
            if resolved not in seen:
                seen.add(resolved)
                cleaned.append(resolved)
        attrs["extra_dirs"] = cleaned
        for key in ("download_dir",):
            value = attrs.get(key)
            if value:
                if not os.access(value, os.R_OK | os.W_OK | os.X_OK):
                    raise serializers.ValidationError(
                        {key: "SeedStation does not have read/write access."}
                    )
        return attrs


class DestinationSerializer(serializers.Serializer):
    name = serializers.CharField()
    path = serializers.CharField()
    free = serializers.IntegerField()
    total = serializers.IntegerField()


def resolve_optional_dir(raw: str) -> str:
    path = Path(raw).expanduser().resolve(strict=False)
    return str(path)
