"""Application-level torrent operations: validation, duplicates, safety."""

from __future__ import annotations

import base64
import binascii
import hashlib
import re
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import bencode
from django.conf import settings

from apps.core.models import AppSettings
from apps.core.paths import PathGuardError, resolve_path, validate_save_path

from . import engine
from .engine import (
    DuplicateTorrent,
    EngineError,
    InvalidTorrent,
    TorrentNotFound,
    UnsafeOperation,
)

HASH_RE = re.compile(r"^[a-fA-F0-9]{40}$")
BASE32_HASH_RE = re.compile(r"^[A-Z2-7a-z2-7]{32}$")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def normalize_hash(value: str) -> str:
    value = value.strip()
    if HASH_RE.fullmatch(value):
        return value.lower()
    if BASE32_HASH_RE.fullmatch(value):
        try:
            decoded = base64.b32decode(value.upper())
        except (binascii.Error, ValueError) as exc:
            raise InvalidTorrent("That magnet link has an invalid info hash.") from exc
        if len(decoded) == 20:
            return decoded.hex()
    raise InvalidTorrent("That magnet link does not contain a valid BitTorrent info hash.")


def parse_magnet(magnet: str) -> dict:
    if not isinstance(magnet, str):
        raise InvalidTorrent("Paste a magnet link first.")
    magnet = magnet.strip()
    if len(magnet) > 8192:
        raise InvalidTorrent("That magnet link is too long.")
    if CONTROL_CHARS_RE.search(magnet):
        raise InvalidTorrent("That magnet link contains invalid characters.")
    if not magnet.lower().startswith("magnet:"):
        raise InvalidTorrent("Magnet links must start with magnet:?")
    parsed = urlparse(magnet)
    if parsed.scheme.lower() != "magnet":
        raise InvalidTorrent("That is not a valid magnet link.")
    query = parse_qs(parsed.query)
    info_hash = None
    for xt in query.get("xt", []):
        if xt.lower().startswith("urn:btih:"):
            info_hash = normalize_hash(xt.split(":", 2)[-1])
            break
    if not info_hash:
        raise InvalidTorrent("Magnet links must include an xt=urn:btih: info hash.")
    display_name = (query.get("dn") or [""])[0][:300]
    return {"hash": info_hash, "name": unquote(display_name), "magnet": magnet}


def parse_torrent_file(data: bytes, filename: str = "") -> dict:
    if not data:
        raise InvalidTorrent("The torrent file is empty.")
    if len(data) > settings.MAX_TORRENT_FILE_SIZE:
        raise InvalidTorrent("Torrent files must be smaller than 10 MB.")
    try:
        # Keep dictionary keys and text as bytes so the info dictionary can be
        # re-encoded exactly enough to derive the torrent's true info hash.
        binary_decoder = bencode.Bencode(encoding=None, dict_ordered=True)
        decoded = binary_decoder.decode(data)
    except Exception as exc:
        raise InvalidTorrent("That file is not a valid bencoded torrent.") from exc
    if not isinstance(decoded, dict):
        raise InvalidTorrent("That file is not a valid torrent.")
    info = decoded.get(b"info")
    if not isinstance(info, dict):
        raise InvalidTorrent("The torrent is missing its info dictionary.")
    name = info.get(b"name")
    if not isinstance(name, bytes) or not name:
        raise InvalidTorrent("The torrent is missing a name.")
    try:
        display_name = name.decode("utf-8", errors="replace")[:300]
    except Exception:
        display_name = filename or "Torrent"
    pieces = info.get(b"pieces")
    piece_length = info.get(b"piece length")
    if not isinstance(pieces, bytes) or len(pieces) == 0 or len(pieces) % 20 != 0:
        raise InvalidTorrent("The torrent has invalid piece data.")
    if not isinstance(piece_length, int) or piece_length <= 0:
        raise InvalidTorrent("The torrent has an invalid piece length.")
    if b"length" not in info and b"files" not in info:
        raise InvalidTorrent("The torrent has no files.")
    try:
        encoded_info = bencode.encode(info)
    except Exception as exc:
        raise InvalidTorrent("The torrent metadata could not be read.") from exc
    info_hash = hashlib.sha1(encoded_info).hexdigest()
    return {"hash": info_hash, "name": display_name, "data": data}


def _destination(save_path: str | None) -> Path:
    try:
        return validate_save_path(save_path)
    except PathGuardError as exc:
        raise InvalidTorrent(str(exc)) from exc


def _ensure_not_duplicate(torrent_hash: str) -> None:
    try:
        existing = engine.get_torrent(torrent_hash)
    except TorrentNotFound:
        return
    except EngineError:
        # If the engine is down, let the add operation surface the real error.
        return
    raise DuplicateTorrent(f"'{existing['name']}' is already in the transfer list.")


def add_magnet(magnet: str, save_path: str | None, start_paused: bool | None = None) -> dict:
    parsed = parse_magnet(magnet)
    destination = _destination(save_path)
    _ensure_not_duplicate(parsed["hash"])
    station = AppSettings.get_solo()
    paused = station.start_paused if start_paused is None else bool(start_paused)
    engine.add_magnet(parsed["magnet"], str(destination), paused)
    return {
        "hash": parsed["hash"],
        "name": parsed["name"] or "New torrent",
        "save_path": str(destination),
        "started_paused": paused,
    }


def add_torrent_file(
    data: bytes,
    filename: str,
    save_path: str | None,
    start_paused: bool | None = None,
) -> dict:
    parsed = parse_torrent_file(data, filename)
    destination = _destination(save_path)
    _ensure_not_duplicate(parsed["hash"])
    station = AppSettings.get_solo()
    paused = station.start_paused if start_paused is None else bool(start_paused)
    engine.add_torrent_file(filename or f"{parsed['hash']}.torrent", data, str(destination), paused)
    return {
        "hash": parsed["hash"],
        "name": parsed["name"],
        "save_path": str(destination),
        "started_paused": paused,
    }


def apply_engine_preferences(station: AppSettings | None = None) -> None:
    station = station or AppSettings.get_solo()
    max_active = int(station.max_active_downloads)
    preferences = {
        "save_path": station.download_dir,
        "temp_path": station.download_dir,
        "temp_path_enabled": False,
        "dl_limit": int(station.max_download_speed),
        "up_limit": int(station.max_upload_speed),
        "max_active_downloads": max_active,
        "max_active_torrents": max(5, max_active + 3),
        "start_paused": bool(station.start_paused),
        "dht": True,
        "pex": True,
        "lsd": True,
        "upnp": False,
        "natpmp": False,
    }
    engine.apply_preferences(preferences)


def delete_torrent(torrent_hash: str, delete_files: bool) -> dict:
    torrent = engine.get_torrent(torrent_hash)
    if delete_files:
        paths = [torrent.get("save_path"), torrent.get("content_path")]
        for raw in paths:
            if not raw:
                continue
            try:
                resolve_path(raw)
            except PathGuardError as exc:
                raise UnsafeOperation(
                    "Refusing to delete files outside the configured download directories. "
                    "Remove the torrent without deleting its files instead."
                ) from exc
    engine.delete_torrent(torrent_hash, delete_files)
    return torrent


def get_torrent_or_404(torrent_hash: str) -> dict:
    if not HASH_RE.fullmatch(torrent_hash):
        raise TorrentNotFound("That torrent does not exist.")
    return engine.get_torrent(torrent_hash)


def safe_hash(torrent_hash: str) -> str:
    if not HASH_RE.fullmatch(torrent_hash):
        raise TorrentNotFound("That torrent does not exist.")
    return torrent_hash.lower()
