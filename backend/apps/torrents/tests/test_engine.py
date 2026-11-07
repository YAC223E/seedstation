from __future__ import annotations

from apps.torrents.engine import normalize_torrent, normalize_transfer


def test_normalize_downloading_torrent():
    raw = {
        "hash": "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
        "name": "Sample",
        "state": "downloading",
        "progress": 0.42,
        "size": 1000,
        "downloaded": 420,
        "dlspeed": 50,
        "upspeed": 5,
        "eta": 100,
        "num_seeds": 3,
        "num_leechs": 4,
        "num_complete": 10,
        "num_incomplete": 20,
        "ratio": 0.1,
        "save_path": "/tmp",
        "content_path": "/tmp/Sample",
        "added_on": 1700000000,
        "completion_on": 0,
        "last_activity": 1700000100,
        "tags": "one, two",
    }
    item = normalize_torrent(raw)
    assert item["hash"] == "abcdef0123456789abcdef0123456789abcdef01"
    assert item["is_downloading"] is True
    assert item["is_complete"] is False
    assert item["eta_seconds"] == 100
    assert item["tags"] == ["one", "two"]
    assert item["added_on"].startswith("2023-11-14")


def test_normalize_completed_paused_torrent():
    item = normalize_torrent(
        {
            "hash": "abcdef0123456789abcdef0123456789abcdef01",
            "state": "pausedUP",
            "progress": 1,
            "size": 10,
            "completion_on": 1700000000,
        }
    )
    assert item["is_complete"] is True
    assert item["is_paused"] is True
    assert item["is_seeding"] is False
    assert item["completed_on"].startswith("2023-11-14")


def test_normalize_uses_completed_bytes_when_downloaded_is_zero():
    """qBittorrent 5.x may zero `downloaded` while `completed` holds the payload."""
    item = normalize_torrent(
        {
            "state": "stalledUP",
            "progress": 1,
            "size": 901,
            "completed": 901,
            "downloaded": 0,
            "downloaded_session": 901,
            "amount_left": 0,
        }
    )
    assert item["downloaded"] == 901
    assert item["downloaded_session"] == 901
    assert item["amount_left"] == 0


def test_normalize_derives_completed_from_amount_left():
    item = normalize_torrent(
        {"state": "downloading", "progress": 0.25, "size": 1000, "amount_left": 750}
    )
    assert item["downloaded"] == 250
    assert item["amount_left"] == 750



def test_normalize_error_torrent():
    item = normalize_torrent({"state": "missingFiles", "progress": 0.5})
    assert item["is_error"] is True
    assert item["activity"] == "error"


def test_infinite_eta_becomes_none():
    item = normalize_torrent({"eta": 8640000, "progress": 0.1, "state": "downloading"})
    assert item["eta_seconds"] is None


def test_normalize_transfer():
    transfer = normalize_transfer(
        {
            "dl_info_speed": 123,
            "up_info_speed": 45,
            "dl_info_data": 1000,
            "up_info_data": 200,
            "connection_status": "connected",
            "dht_nodes": 8,
        }
    )
    assert transfer["download_speed"] == 123
    assert transfer["connection_label"] == "Connected"
