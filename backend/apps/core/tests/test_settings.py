from __future__ import annotations

import json
from pathlib import Path

import pytest

from apps.core.models import AppSettings

pytestmark = pytest.mark.django_db


def snapshot_stub():
    return {
        "engine": {"online": True, "version": "5.3.0", "api_version": "2.16.2"},
        "storage": {"path": "/tmp", "total": 1, "used": 0, "free": 1, "percent": 0, "library_bytes": 0},
        "summary": {"total": 0},
    }


def test_settings_patch_saves_limits(auth_client, download_root, monkeypatch):
    monkeypatch.setattr(
        "apps.core.views.collect_live_snapshot",
        lambda record=False: snapshot_stub(),
    )
    monkeypatch.setattr("apps.core.views.apply_engine_preferences", lambda station: None)
    response = auth_client.patch(
        "/api/settings/",
        data=json.dumps(
            {
                "download_dir": str(download_root),
                "max_download_speed": 5_000_000,
                "max_upload_speed": 1_000_000,
                "max_active_downloads": 4,
                "start_paused": True,
                "theme": "light",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 200
    station = AppSettings.get_solo()
    assert station.max_download_speed == 5_000_000
    assert station.max_active_downloads == 4
    assert station.start_paused is True
    assert station.theme == "light"


def test_settings_reject_system_directory(auth_client, monkeypatch):
    monkeypatch.setattr("apps.core.views.collect_live_snapshot", lambda record=False: snapshot_stub())
    response = auth_client.patch(
        "/api/settings/",
        data=json.dumps({"download_dir": "/"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_settings_reject_negative_speed(auth_client, download_root, monkeypatch):
    monkeypatch.setattr("apps.core.views.collect_live_snapshot", lambda record=False: snapshot_stub())
    response = auth_client.patch(
        "/api/settings/",
        data=json.dumps({"max_download_speed": -1}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_settings_engine_sync_failure_is_reported(auth_client, download_root, monkeypatch):
    monkeypatch.setattr("apps.core.views.collect_live_snapshot", lambda record=False: snapshot_stub())
    monkeypatch.setattr(
        "apps.core.views.apply_engine_preferences",
        lambda station: (_ for _ in ()).throw(__import__("apps.torrents.engine", fromlist=["EngineUnavailable"]).EngineUnavailable("offline")),
    )
    response = auth_client.patch(
        "/api/settings/",
        data=json.dumps({"max_active_downloads": 2}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert "offline" in response.json()["sync_warning"].lower()


def test_extra_dirs_must_exist(auth_client, download_root, tmp_path, monkeypatch):
    monkeypatch.setattr("apps.core.views.collect_live_snapshot", lambda record=False: snapshot_stub())
    response = auth_client.patch(
        "/api/settings/",
        data=json.dumps({"extra_dirs": [str(tmp_path / "missing")]}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_extra_dirs_accepted(auth_client, download_root, tmp_path, monkeypatch):
    extra = tmp_path / "extra"
    extra.mkdir()
    monkeypatch.setattr("apps.core.views.collect_live_snapshot", lambda record=False: snapshot_stub())
    monkeypatch.setattr("apps.core.views.apply_engine_preferences", lambda station: None)
    response = auth_client.patch(
        "/api/settings/",
        data=json.dumps({"extra_dirs": [str(extra)]}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert AppSettings.get_solo().extra_dirs == [str(extra)]
