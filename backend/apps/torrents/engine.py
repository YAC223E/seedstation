"""Encapsulated qBittorrent Web API client and normalization layer.

The React app never talks to qBittorrent. Everything goes through Django and
this module. The client is a process-local singleton guarded by a lock because
a single requests.Session is not safe for concurrent use.
"""

from __future__ import annotations

import logging
import mimetypes
import threading
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, Callable, TypeVar

import qbittorrentapi
import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

T = TypeVar("T")

PAUSED_STATES = {"pausedDL", "pausedUP", "stoppedDL", "stoppedUP"}
ERROR_STATES = {"error", "missingFiles"}
CHECKING_STATES = {"checkingUP", "checkingDL", "checkingResumeData", "moving", "allocating"}
DOWNLOADING_STATES = {"downloading", "forcedDL", "stalledDL", "queuedDL", "metaDL", "forcedMetaDL"}
SEEDING_STATES = {"uploading", "forcedUP", "stalledUP", "queuedUP"}

# qBittorrent file priority values from its Web API.
FILE_PRIORITIES = {"skip": 0, "normal": 1, "high": 6, "max": 7}

STATUS_LABELS = {
    "error": "Error",
    "missingFiles": "Missing files",
    "uploading": "Seeding",
    "forcedUP": "Seeding",
    "stalledUP": "Seeding (stalled)",
    "queuedUP": "Queued",
    "checkingUP": "Checking",
    "pausedUP": "Paused",
    "stoppedUP": "Stopped",
    "downloading": "Downloading",
    "forcedDL": "Downloading",
    "stalledDL": "Stalled",
    "queuedDL": "Queued",
    "checkingDL": "Checking",
    "pausedDL": "Paused",
    "stoppedDL": "Stopped",
    "metaDL": "Fetching metadata",
    "forcedMetaDL": "Fetching metadata",
    "checkingResumeData": "Checking",
    "moving": "Moving",
    "allocating": "Allocating",
    "unknown": "Unknown",
}


class EngineError(Exception):
    status_code = 503
    code = "engine_error"

    def __init__(self, message: str, *, code: str | None = None):
        super().__init__(message)
        if code:
            self.code = code


class EngineUnavailable(EngineError):
    status_code = 503
    code = "engine_unavailable"


class EngineAuthError(EngineError):
    status_code = 502
    code = "engine_auth_failed"


class TorrentNotFound(EngineError):
    status_code = 404
    code = "torrent_not_found"


class DuplicateTorrent(EngineError):
    status_code = 409
    code = "torrent_already_exists"


class InvalidTorrent(EngineError):
    status_code = 400
    code = "invalid_torrent"


class UnsafeOperation(EngineError):
    status_code = 403
    code = "unsafe_operation"


_client: qbittorrentapi.Client | None = None
_logged_in = False
_lock = threading.RLock()


def _create_client() -> qbittorrentapi.Client:
    return qbittorrentapi.Client(
        host=settings.QBIT_HOST,
        port=settings.QBIT_PORT,
        username=settings.QBIT_USERNAME,
        password=settings.QBIT_PASSWORD,
        VERIFY_WEBUI_CERTIFICATE=False,
        RAISE_ERROR_FOR_UNSUPPORTED_QBITTORRENT_VERSIONS=False,
        REQUESTS_ARGS={
            "timeout": (settings.QBIT_CONNECT_TIMEOUT, settings.QBIT_READ_TIMEOUT)
        },
        DISABLE_LOGGING_DEBUG_OUTPUT=True,
    )


def _reset_client() -> None:
    global _client, _logged_in
    try:
        if _client is not None:
            _client.auth_log_out()
    except Exception:
        pass
    _client = None
    _logged_in = False


def _ensure_login() -> qbittorrentapi.Client:
    global _client, _logged_in
    if _client is None:
        _client = _create_client()
    if not _logged_in:
        try:
            _client.auth_log_in()
        except qbittorrentapi.LoginFailed as exc:
            _logged_in = False
            raise EngineAuthError(
                "The torrent engine rejected its credentials. Check the qBittorrent "
                "settings in .env and restart SeedStation."
            ) from exc
        except qbittorrentapi.APIConnectionError as exc:
            _logged_in = False
            raise EngineUnavailable(
                "The torrent engine is not reachable. It may be restarting."
            ) from exc
        except requests.RequestException as exc:
            _logged_in = False
            raise EngineUnavailable(
                "The torrent engine is not reachable. It may be restarting."
            ) from exc
        _logged_in = True
    return _client


def _execute(operation: Callable[[qbittorrentapi.Client], T]) -> T:
    global _logged_in
    with _lock:
        try:
            client = _ensure_login()
            return operation(client)
        except EngineError:
            raise
        except qbittorrentapi.LoginFailed as exc:
            _logged_in = False
            raise EngineAuthError(
                "The torrent engine rejected its credentials. Check the qBittorrent "
                "settings in .env and restart SeedStation."
            ) from exc
        except qbittorrentapi.Forbidden403Error as exc:
            _logged_in = False
            raise EngineAuthError(
                "SeedStation could not authorize with the torrent engine."
            ) from exc
        except qbittorrentapi.Conflict409Error as exc:
            raise DuplicateTorrent("That torrent is already in the transfer list.") from exc
        except qbittorrentapi.NotFound404Error as exc:
            raise TorrentNotFound("That torrent no longer exists.") from exc
        except qbittorrentapi.UnsupportedMediaType415Error as exc:
            raise InvalidTorrent("qBittorrent rejected that torrent file.") from exc
        except qbittorrentapi.APIConnectionError as exc:
            _logged_in = False
            logger.warning("qBittorrent connection failed: %s", exc)
            raise EngineUnavailable(
                "The torrent engine is not reachable. It may be restarting."
            ) from exc
        except requests.RequestException as exc:
            _logged_in = False
            logger.warning("qBittorrent request failed: %s", exc)
            raise EngineUnavailable(
                "The torrent engine is not reachable. It may be restarting."
            ) from exc
        except qbittorrentapi.APIError as exc:
            logger.warning("qBittorrent API error: %s", exc)
            raise EngineError("The torrent engine could not complete that request.") from exc


def _timestamp(value: Any) -> str | None:
    try:
        seconds = int(value or 0)
    except (TypeError, ValueError):
        return None
    if seconds <= 0:
        return None
    return datetime.fromtimestamp(seconds, tz=UTC).isoformat()


def _number(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _integer(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _activity_for(state: str, is_complete: bool) -> str:
    if state in ERROR_STATES:
        return "error"
    if state in PAUSED_STATES:
        return "paused"
    if state in CHECKING_STATES:
        return "checking"
    if state in {"metaDL", "forcedMetaDL"}:
        return "metadata"
    if state in DOWNLOADING_STATES:
        return "downloading"
    if state in SEEDING_STATES:
        return "seeding"
    if is_complete:
        return "seeding"
    return "unknown"


def normalize_torrent(raw: Any) -> dict:
    get = raw.get
    state = str(get("state") or "unknown")
    progress = max(0.0, min(1.0, _number(get("progress"))))
    is_complete = progress >= 0.999
    is_paused = state in PAUSED_STATES
    is_error = state in ERROR_STATES
    activity = _activity_for(state, is_complete)
    tags = [item.strip() for item in str(get("tags") or "").split(",") if item.strip()]
    eta = _integer(get("eta"), -1)
    if eta < 0 or eta >= 8640000:
        eta = None
    size = _integer(get("size") or get("total_size"))
    amount_left = _integer(get("amount_left"), -1)
    completed = _integer(get("completed"), -1)
    if completed < 0:
        completed = (
            max(0, size - amount_left)
            if amount_left >= 0
            else int(round(size * progress))
        )
    if amount_left < 0:
        amount_left = max(0, size - completed)
    # qBittorrent 5.x can report `downloaded` as zero even after a fresh
    # transfer, keeping the real bytes in `completed`/`downloaded_session`.
    # Use the completed payload counter so the UI reflects actual progress.
    downloaded = completed
    return {
        "hash": str(get("hash") or "").lower(),
        "name": str(get("name") or "Unnamed torrent"),
        "state": state,
        "status": STATUS_LABELS.get(state, state.replace("_", " ").title()),
        "activity": activity,
        "is_complete": is_complete,
        "is_paused": is_paused,
        "is_error": is_error,
        "is_downloading": not is_complete and not is_paused and not is_error,
        "is_seeding": is_complete and not is_paused and not is_error,
        "progress": progress,
        "size": size,
        "downloaded": downloaded,
        "amount_left": amount_left,
        "download_speed": _integer(get("dlspeed")),
        "upload_speed": _integer(get("upspeed")),
        "downloaded_session": _integer(get("downloaded_session")),
        "uploaded": _integer(get("uploaded")),
        "uploaded_session": _integer(get("uploaded_session")),
        "eta_seconds": eta,
        "ratio": round(_number(get("ratio")), 3),
        "seeds": _integer(get("num_seeds")),
        "peers": _integer(get("num_leechs")),
        "swarm_seeds": _integer(get("num_complete")),
        "swarm_peers": _integer(get("num_incomplete")),
        "save_path": str(get("save_path") or ""),
        "content_path": str(get("content_path") or ""),
        "magnet": str(get("magnet_uri") or ""),
        "tracker": str(get("tracker") or ""),
        "category": str(get("category") or ""),
        "tags": tags,
        "added_on": _timestamp(get("added_on")),
        "completed_on": _timestamp(get("completion_on")),
        "last_activity": _timestamp(get("last_activity")),
        "time_active": _integer(get("time_active")),
        "seeding_time": _integer(get("seeding_time")),
        "priority": _integer(get("priority")),
        "is_private": bool(get("is_private") or get("private")),
    }


def normalize_transfer(raw: Any) -> dict:
    connection = str(raw.get("connection_status") or "unknown")
    labels = {
        "connected": "Connected",
        "firewalled": "Firewalled",
        "disconnected": "Disconnected",
        "unknown": "Unknown",
    }
    return {
        "download_speed": _integer(raw.get("dl_info_speed")),
        "upload_speed": _integer(raw.get("up_info_speed")),
        "downloaded_session": _integer(raw.get("dl_info_data")),
        "uploaded_session": _integer(raw.get("up_info_data")),
        "download_limit": _integer(raw.get("dl_rate_limit")),
        "upload_limit": _integer(raw.get("up_rate_limit")),
        "connection_status": connection,
        "connection_label": labels.get(connection, connection.title()),
        "dht_nodes": _integer(raw.get("dht_nodes")),
        "queueing": bool(raw.get("queueing")),
    }


def normalize_file(raw: Any) -> dict:
    name = str(raw.get("name") or "")
    mime, _ = mimetypes.guess_type(name)
    return {
        "index": _integer(raw.get("index")),
        "name": name,
        "size": _integer(raw.get("size")),
        "progress": round(max(0.0, min(1.0, _number(raw.get("progress")))), 4),
        "priority": _integer(raw.get("priority")),
        "is_seed": bool(raw.get("is_seed")),
        "piece_range": raw.get("piece_range") or [],
        "availability": round(_number(raw.get("availability")), 3),
        "mime": mime or "application/octet-stream",
    }


def normalize_tracker(raw: Any) -> dict:
    status = _integer(raw.get("status"), -1)
    labels = {
        0: "Disabled",
        1: "Not contacted",
        2: "Working",
        3: "Updating",
        4: "Not working",
    }
    return {
        "url": str(raw.get("url") or ""),
        "status": status,
        "status_label": labels.get(status, "Unknown"),
        "tier": _integer(raw.get("tier")),
        "peers": _integer(raw.get("num_peers")),
        "seeds": _integer(raw.get("num_seeds")),
        "leeches": _integer(raw.get("num_leeches")),
        "message": str(raw.get("msg") or ""),
    }


def _cached_version() -> dict | None:
    return cache.get("seedstation:qbit_version")


def get_engine_snapshot() -> tuple[list[dict], dict, dict]:
    """Return normalized torrents, transfer info and version information."""

    def operation(client: qbittorrentapi.Client):
        torrents = client.torrents_info()
        transfer = client.transfer_info()
        version_info = _cached_version()
        if not version_info:
            version_info = {
                "version": str(client.app_version()).lstrip("v"),
                "api_version": str(client.app_web_api_version()),
            }
            cache.set("seedstation:qbit_version", version_info, 60)
        return torrents, transfer, version_info

    raw_torrents, raw_transfer, version_info = _execute(operation)
    torrents = [normalize_torrent(item) for item in raw_torrents]
    torrents.sort(
        key=lambda item: item.get("added_on") or "",
        reverse=True,
    )
    return (
        torrents,
        normalize_transfer(raw_transfer),
        {
            "online": True,
            "version": version_info.get("version"),
            "api_version": version_info.get("api_version"),
            "error": None,
        },
    )


def get_torrents() -> list[dict]:
    return _execute(lambda client: [normalize_torrent(t) for t in client.torrents_info()])


def get_engine_info() -> dict:
    try:
        version_info = _cached_version()
        if not version_info:
            def read_version(client):
                data = {
                    "version": str(client.app_version()).lstrip("v"),
                    "api_version": str(client.app_web_api_version()),
                }
                cache.set("seedstation:qbit_version", data, 60)
                return data

            version_info = _execute(read_version)
        # Verify the engine is still responsive, not just that a cached version exists.
        _execute(lambda client: client.transfer_info())
        return {
            "online": True,
            "version": version_info.get("version"),
            "api_version": version_info.get("api_version"),
            "error": None,
        }
    except EngineError as exc:
        return {"online": False, "version": None, "api_version": None, "error": str(exc)}


def get_torrent(torrent_hash: str) -> dict:
    def operation(client):
        items = client.torrents_info(torrent_hashes=torrent_hash)
        if not items:
            raise TorrentNotFound("That torrent no longer exists.")
        return normalize_torrent(items[0])

    return _execute(operation)


def get_torrent_detail(torrent_hash: str) -> dict:
    def operation(client):
        items = client.torrents_info(torrent_hashes=torrent_hash)
        if not items:
            raise TorrentNotFound("That torrent no longer exists.")
        files = client.torrents_files(torrent_hash=torrent_hash)
        trackers = client.torrents_trackers(torrent_hash=torrent_hash)
        detail = normalize_torrent(items[0])
        detail["files"] = [normalize_file(item) for item in files]
        detail["trackers"] = [normalize_tracker(item) for item in trackers]
        return detail

    return _execute(operation)


def _add_was_accepted(result: Any) -> bool:
    """qBittorrent 5.3 returns JSON metadata; older versions return 'Ok.'."""
    if isinstance(result, Mapping):
        if int(result.get("failure_count") or 0) > 0:
            return False
        if "success_count" in result and int(result.get("success_count") or 0) == 0:
            return False
        return True
    return str(result).strip() in {"Ok.", "Ok", ""}


def add_magnet(magnet: str, save_path: str, paused: bool) -> dict | None:
    def operation(client):
        result = client.torrents_add(
            urls=magnet,
            save_path=save_path,
            is_paused=paused,
            use_auto_torrent_management=False,
            add_to_top_of_queue=True,
        )
        return result

    result = _execute(operation)
    if not _add_was_accepted(result):
        raise InvalidTorrent("qBittorrent could not add that magnet link.")
    return None


def add_torrent_file(filename: str, data: bytes, save_path: str, paused: bool) -> dict | None:
    def operation(client):
        return client.torrents_add(
            torrent_files={filename: data},
            save_path=save_path,
            is_paused=paused,
            use_auto_torrent_management=False,
            add_to_top_of_queue=True,
        )

    result = _execute(operation)
    if not _add_was_accepted(result):
        raise InvalidTorrent("qBittorrent could not add that torrent file.")
    return None


def pause_torrent(torrent_hash: str) -> None:
    _execute(lambda client: client.torrents_pause(torrent_hashes=torrent_hash))


def resume_torrent(torrent_hash: str) -> None:
    _execute(lambda client: client.torrents_resume(torrent_hashes=torrent_hash))


def recheck_torrent(torrent_hash: str) -> None:
    _execute(lambda client: client.torrents_recheck(torrent_hashes=torrent_hash))


def set_file_priority(torrent_hash: str, file_indexes: list[int], priority: int) -> None:
    _execute(
        lambda client: client.torrents_file_priority(
            torrent_hash=torrent_hash, file_ids=file_indexes, priority=priority
        )
    )


def delete_torrent(torrent_hash: str, delete_files: bool) -> None:
    _execute(
        lambda client: client.torrents_delete(
            delete_files=delete_files, torrent_hashes=torrent_hash
        )
    )


def apply_preferences(preferences: dict) -> None:
    def operation(client):
        current = client.app_preferences()
        filtered = {key: value for key, value in preferences.items() if key in current}
        if filtered:
            client.app_set_preferences(filtered)

    _execute(operation)


def get_preferences() -> dict:
    return _execute(lambda client: dict(client.app_preferences()))


def reset_engine_connection() -> None:
    """Used after a configuration change or in tests."""
    with _lock:
        _reset_client()
