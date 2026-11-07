from __future__ import annotations

import pytest

from apps.torrents import live
from apps.torrents.engine import EngineUnavailable

pytestmark = pytest.mark.django_db


def test_live_snapshot_is_graceful_when_engine_is_offline(auth_client, download_root, monkeypatch):
    monkeypatch.setattr(
        "apps.torrents.live.get_engine_snapshot",
        lambda: (_ for _ in ()).throw(EngineUnavailable("engine restarting")),
    )
    response = auth_client.get("/api/live/")
    assert response.status_code == 200
    data = response.json()
    assert data["engine"]["online"] is False
    assert data["torrents"] == []
    assert data["storage"]["free"] > 0
    assert data["summary"]["total"] == 0


def test_live_snapshot_with_torrents(auth_client, download_root, monkeypatch):
    torrent = {
        "hash": "0123456789abcdef0123456789abcdef01234567",
        "name": "Legal Sample",
        "state": "downloading",
        "status": "Downloading",
        "activity": "downloading",
        "is_complete": False,
        "is_paused": False,
        "is_error": False,
        "is_downloading": True,
        "is_seeding": False,
        "progress": 0.5,
        "size": 100,
        "downloaded": 50,
        "amount_left": 50,
        "download_speed": 12,
        "upload_speed": 1,
        "downloaded_session": 50,
        "uploaded": 0,
        "uploaded_session": 0,
        "eta_seconds": 5,
        "ratio": 0,
        "seeds": 1,
        "peers": 2,
        "swarm_seeds": 3,
        "swarm_peers": 4,
        "save_path": str(download_root),
        "content_path": str(download_root / "sample.bin"),
        "magnet": "",
        "tracker": "",
        "category": "",
        "tags": [],
        "added_on": "2026-01-01T00:00:00+00:00",
        "completed_on": None,
        "last_activity": "2026-01-01T00:00:00+00:00",
        "time_active": 10,
        "seeding_time": 0,
        "priority": 0,
        "is_private": False,
    }
    monkeypatch.setattr(
        "apps.torrents.live.get_engine_snapshot",
        lambda: (
            [torrent],
            {
                "download_speed": 12,
                "upload_speed": 1,
                "downloaded_session": 50,
                "uploaded_session": 0,
                "download_limit": 0,
                "upload_limit": 0,
                "connection_status": "connected",
                "connection_label": "Connected",
                "dht_nodes": 3,
                "queueing": False,
            },
            {"online": True, "version": "5.3.0", "api_version": "2.16.2", "error": None},
        ),
    )
    data = auth_client.get("/api/live/").json()
    assert data["summary"]["active"] == 1
    assert data["summary"]["downloading"] == 1
    assert data["torrents"][0]["name"] == "Legal Sample"
    assert data["engine"]["online"] is True


def test_history_returns_collected_samples(auth_client, download_root):
    from apps.core.models import TelemetrySample

    TelemetrySample.objects.create(
        download_speed=100,
        upload_speed=10,
        active_downloads=1,
        active_torrents=1,
        total_torrents=1,
        library_bytes=500,
        storage_used=1000,
        storage_free=9000,
    )
    response = auth_client.get("/api/dashboard/history/", {"hours": 1})
    assert response.status_code == 200
    data = response.json()
    assert data["sampled"] == 1
    assert data["points"][0]["download_speed"] == 100
