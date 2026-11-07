"""Live snapshot assembly shared by REST and WebSocket transports."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.core.models import AppSettings, TelemetrySample
from apps.core.server import disk_stats, server_info

from .engine import EngineError, get_engine_snapshot

logger = logging.getLogger(__name__)


def _empty_transfer(error: str) -> dict:
    return {
        "download_speed": 0,
        "upload_speed": 0,
        "downloaded_session": 0,
        "uploaded_session": 0,
        "download_limit": 0,
        "upload_limit": 0,
        "connection_status": "unavailable",
        "connection_label": "Engine offline",
        "dht_nodes": 0,
        "queueing": False,
        "error": error,
    }


def _summary(torrents: list[dict], library_bytes: int) -> dict:
    return {
        "total": len(torrents),
        "active": sum(1 for t in torrents if t["is_downloading"] or t["is_seeding"]),
        "downloading": sum(1 for t in torrents if t["is_downloading"]),
        "seeding": sum(1 for t in torrents if t["is_seeding"]),
        "completed": sum(1 for t in torrents if t["is_complete"]),
        "paused": sum(1 for t in torrents if t["is_paused"]),
        "errored": sum(1 for t in torrents if t["is_error"]),
        "library_bytes": library_bytes,
    }


def _recent(torrents: list[dict], limit: int = 6) -> list[dict]:
    completed = [t for t in torrents if t["is_complete"]]
    completed.sort(
        key=lambda item: item.get("completed_on") or item.get("last_activity") or "",
        reverse=True,
    )
    return completed[:limit]


def collect_live_snapshot(*, record: bool = True) -> dict:
    station = AppSettings.get_solo()
    error: str | None = None
    torrents: list[dict] = []
    transfer = _empty_transfer("")
    engine_info = {
        "online": False,
        "version": None,
        "api_version": None,
        "error": "The torrent engine is not reachable.",
        "webui_url": f"http://{settings.QBIT_HOST}:{settings.QBIT_PORT}",
    }
    try:
        torrents, transfer, engine_info = get_engine_snapshot()
        engine_info["webui_url"] = f"http://{settings.QBIT_HOST}:{settings.QBIT_PORT}"
    except EngineError as exc:
        error = str(exc)
        transfer = _empty_transfer(error)
        engine_info["error"] = error
        logger.warning("Live snapshot engine error: %s", exc)

    storage = disk_stats(station.download_dir)
    library_bytes = sum(t["size"] for t in torrents if t["is_complete"])
    storage["library_bytes"] = library_bytes
    storage["library_percent"] = (
        round((library_bytes / storage["total"]) * 100, 1) if storage.get("total") else 0
    )
    summary = _summary(torrents, library_bytes)
    server = server_info()
    snapshot = {
        "timestamp": datetime.now(UTC).isoformat(),
        "engine": engine_info,
        "transfer": transfer,
        "torrents": torrents,
        "summary": summary,
        "storage": storage,
        "recent": _recent(torrents),
        "server": server,
    }
    if record:
        record_telemetry(snapshot)
    return snapshot


def record_telemetry(snapshot: dict) -> None:
    """Persist a sample at most every 20 seconds, from any request/WS client."""
    if not cache.add("seedstation:telemetry:record", 1, timeout=20):
        return
    try:
        TelemetrySample.objects.create(
            engine_online=snapshot["engine"]["online"],
            download_speed=snapshot["transfer"]["download_speed"],
            upload_speed=snapshot["transfer"]["upload_speed"],
            active_downloads=snapshot["summary"]["downloading"],
            active_torrents=snapshot["summary"]["active"],
            total_torrents=snapshot["summary"]["total"],
            library_bytes=snapshot["storage"]["library_bytes"],
            storage_used=snapshot["storage"]["used"],
            storage_free=snapshot["storage"]["free"],
        )
    except Exception:
        logger.exception("Could not save telemetry sample")
        cache.delete("seedstation:telemetry:record")
        return

    if cache.add("seedstation:telemetry:prune", 1, timeout=60 * 60 * 12):
        cutoff = timezone.now() - timedelta(days=settings.TELEMETRY_RETENTION_DAYS)
        try:
            TelemetrySample.objects.filter(created_at__lt=cutoff).delete()
        except Exception:
            logger.exception("Could not prune old telemetry")


def history(hours: int = 6, max_points: int = 180) -> dict:
    hours = max(1, min(int(hours), 24 * 7))
    now = timezone.now()
    start = now - timedelta(hours=hours)
    queryset = TelemetrySample.objects.filter(created_at__gte=start).order_by("created_at")
    rows = list(
        queryset.values(
            "created_at",
            "engine_online",
            "download_speed",
            "upload_speed",
            "active_downloads",
            "active_torrents",
            "total_torrents",
            "library_bytes",
            "storage_free",
        )
    )
    if not rows:
        return {"hours": hours, "points": [], "sampled": 0, "start": start.isoformat()}

    if len(rows) <= max_points:
        points = [
            {
                "timestamp": row["created_at"].isoformat(),
                "engine_online": row["engine_online"],
                "download_speed": row["download_speed"],
                "upload_speed": row["upload_speed"],
                "active_downloads": row["active_downloads"],
                "active_torrents": row["active_torrents"],
                "total_torrents": row["total_torrents"],
                "library_bytes": row["library_bytes"],
                "storage_free": row["storage_free"],
            }
            for row in rows
        ]
        return {
            "hours": hours,
            "points": points,
            "sampled": len(rows),
            "start": start.isoformat(),
        }

    total_seconds = max(1.0, (now - start).total_seconds())
    bucket_seconds = total_seconds / max_points
    buckets: list[list[dict]] = [[] for _ in range(max_points)]
    for row in rows:
        offset = max(0.0, (row["created_at"] - start).total_seconds())
        index = min(max_points - 1, int(offset / bucket_seconds))
        buckets[index].append(row)
    points = []
    for index, bucket in enumerate(buckets):
        if not bucket:
            continue
        bucket_start = start + timedelta(seconds=bucket_seconds * index)
        points.append(
            {
                "timestamp": bucket_start.isoformat(),
                "engine_online": any(item["engine_online"] for item in bucket),
                "download_speed": int(
                    sum(item["download_speed"] for item in bucket) / len(bucket)
                ),
                "upload_speed": int(
                    sum(item["upload_speed"] for item in bucket) / len(bucket)
                ),
                "active_downloads": int(
                    sum(item["active_downloads"] for item in bucket) / len(bucket)
                ),
                "active_torrents": int(
                    sum(item["active_torrents"] for item in bucket) / len(bucket)
                ),
                "total_torrents": int(
                    sum(item["total_torrents"] for item in bucket) / len(bucket)
                ),
                "library_bytes": int(
                    sum(item["library_bytes"] for item in bucket) / len(bucket)
                ),
                "storage_free": int(
                    sum(item["storage_free"] for item in bucket) / len(bucket)
                ),
            }
        )
    return {
        "hours": hours,
        "points": points,
        "sampled": len(rows),
        "start": start.isoformat(),
    }


__all__ = ["collect_live_snapshot", "history", "record_telemetry"]
