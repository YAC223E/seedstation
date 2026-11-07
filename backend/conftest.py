from __future__ import annotations

from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.core.models import AppSettings


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def download_root(tmp_path: Path, db) -> Path:
    root = tmp_path / "downloads"
    root.mkdir()
    station = AppSettings.get_solo()
    station.download_dir = str(root)
    station.extra_dirs = []
    station.max_download_speed = 0
    station.max_upload_speed = 0
    station.max_active_downloads = 3
    station.start_paused = False
    station.save()
    return root


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(
        username="tester",
        email="tester@example.test",
        password="correct-horse-battery-staple",
    )


@pytest.fixture
def auth_client(client, user):
    client.force_login(user)
    return client
