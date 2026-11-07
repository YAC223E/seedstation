from __future__ import annotations

import json
from pathlib import Path

import pytest

from apps.torrents.engine import DuplicateTorrent, InvalidTorrent
from apps.torrents.service import parse_magnet, parse_torrent_file

pytestmark = pytest.mark.django_db

VALID_HASH = "0123456789abcdef0123456789abcdef01234567"
MAGNET = f"magnet:?xt=urn:btih:{VALID_HASH}&dn=Test+Torrent"


def test_parse_magnet_hex():
    parsed = parse_magnet(MAGNET)
    assert parsed["hash"] == VALID_HASH
    assert parsed["name"] == "Test Torrent"


def test_parse_magnet_rejects_invalid():
    with pytest.raises(InvalidTorrent):
        parse_magnet("https://example.com/file.torrent")
    with pytest.raises(InvalidTorrent):
        parse_magnet("magnet:?dn=no-hash")


def test_magnet_endpoint(auth_client, download_root, monkeypatch):
    monkeypatch.setattr(
        "apps.torrents.views.add_magnet",
        lambda magnet, save_path, paused: {
            "hash": VALID_HASH,
            "name": "Test Torrent",
            "save_path": str(download_root),
            "started_paused": False,
        },
    )
    response = auth_client.post(
        "/api/torrents/add-magnet/",
        data=json.dumps({"magnet": MAGNET, "save_path": str(download_root)}),
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["torrent"]["hash"] == VALID_HASH


def test_magnet_invalid_returns_400(auth_client, download_root):
    response = auth_client.post(
        "/api/torrents/add-magnet/",
        data=json.dumps({"magnet": "not-a-magnet"}),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_torrent"


def test_duplicate_magnet_returns_409(auth_client, download_root, monkeypatch):
    def duplicate(*args, **kwargs):
        raise DuplicateTorrent("Already exists")

    monkeypatch.setattr("apps.torrents.views.add_magnet", duplicate)
    response = auth_client.post(
        "/api/torrents/add-magnet/",
        data=json.dumps({"magnet": MAGNET}),
        content_type="application/json",
    )
    assert response.status_code == 409


def test_upload_invalid_torrent(auth_client, download_root):
    response = auth_client.post(
        "/api/torrents/upload/",
        {"file": __import__("django").core.files.uploadedfile.SimpleUploadedFile(
            "bad.torrent", b"not a torrent", content_type="application/x-bittorrent"
        )},
    )
    assert response.status_code == 400


def test_pause_resume_recheck(auth_client, monkeypatch):
    calls = []
    monkeypatch.setattr("apps.torrents.views.engine.pause_torrent", lambda h: calls.append(("pause", h)))
    monkeypatch.setattr("apps.torrents.views.engine.resume_torrent", lambda h: calls.append(("resume", h)))
    monkeypatch.setattr("apps.torrents.views.engine.recheck_torrent", lambda h: calls.append(("recheck", h)))
    for action in ("pause", "resume", "recheck"):
        response = auth_client.post(f"/api/torrents/{VALID_HASH}/{action}/")
        assert response.status_code == 200
    assert calls == [
        ("pause", VALID_HASH),
        ("resume", VALID_HASH),
        ("recheck", VALID_HASH),
    ]


def test_delete_requires_delete_confirmation(auth_client, monkeypatch):
    called = []
    monkeypatch.setattr(
        "apps.torrents.views.delete_torrent",
        lambda h, delete_files: called.append((h, delete_files)) or {"name": "x"},
    )
    response = auth_client.delete(
        f"/api/torrents/{VALID_HASH}/",
        data=json.dumps({"confirm": "yes"}),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert called == []


def test_delete_with_files(auth_client, monkeypatch):
    called = []
    monkeypatch.setattr(
        "apps.torrents.views.delete_torrent",
        lambda h, delete_files: called.append((h, delete_files)) or {"name": "x"},
    )
    response = auth_client.delete(
        f"/api/torrents/{VALID_HASH}/",
        data=json.dumps({"confirm": "DELETE", "delete_files": True}),
        content_type="application/json",
    )
    assert response.status_code == 204
    assert called == [(VALID_HASH, True)]


def test_torrent_list_engine_offline(auth_client, monkeypatch):
    from apps.torrents.engine import EngineUnavailable

    monkeypatch.setattr(
        "apps.torrents.views.engine.get_torrents",
        lambda: (_ for _ in ()).throw(EngineUnavailable("offline")),
    )
    response = auth_client.get("/api/torrents/")
    assert response.status_code == 503
    assert response.json()["code"] == "engine_unavailable"


def test_detail_engine_error(auth_client, monkeypatch):
    from apps.torrents.engine import TorrentNotFound

    monkeypatch.setattr(
        "apps.torrents.views.engine.get_torrent_detail",
        lambda h: (_ for _ in ()).throw(TorrentNotFound("gone")),
    )
    response = auth_client.get(f"/api/torrents/{VALID_HASH}/")
    assert response.status_code == 404


def test_parse_torrent_bytes():
    import hashlib
    import io

    import bencode

    payload = b"hello torrent"
    pieces = hashlib.sha1(payload).digest()
    info = {
        b"name": b"hello.txt",
        b"length": len(payload),
        b"piece length": 16384,
        b"pieces": pieces,
    }
    data = bencode.encode({b"announce": b"http://127.0.0.1/announce", b"info": info})
    parsed = parse_torrent_file(data)
    assert parsed["name"] == "hello.txt"
    assert parsed["hash"] == hashlib.sha1(bencode.encode(info)).hexdigest()
