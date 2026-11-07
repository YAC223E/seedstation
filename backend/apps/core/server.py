"""Read-only server and filesystem information shown in the UI."""

from __future__ import annotations

import os
import platform
import shutil
import socket
import time
from datetime import UTC, datetime
from pathlib import Path

import django
from django.conf import settings
from django.core.cache import cache

PROCESS_STARTED_AT = time.time()


def get_lan_ip() -> str:
    """Best-effort LAN address, without sending network traffic."""
    cached = cache.get("seedstation:lan_ip")
    if cached:
        return cached
    candidates: list[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(0.5)
            sock.connect(("8.8.8.8", 80))
            candidates.append(sock.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            candidates.append(info[4][0])
    except OSError:
        pass
    for candidate in candidates:
        if candidate and not candidate.startswith("127.") and candidate != "0.0.0.0":
            cache.set("seedstation:lan_ip", candidate, 60)
            return candidate
    return candidates[0] if candidates else "127.0.0.1"


def server_uptime_seconds() -> int | None:
    try:
        with open("/proc/uptime", encoding="ascii") as handle:
            return int(float(handle.read().split()[0]))
    except (OSError, ValueError):
        return None


def process_uptime_seconds() -> int:
    return max(0, int(time.time() - PROCESS_STARTED_AT))


def _system_name() -> str:
    try:
        with open("/etc/os-release", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("PRETTY_NAME="):
                    return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return platform.system()


def disk_stats(path: str | Path | None = None) -> dict:
    target = Path(path or settings.SEEDSTATION_DOWNLOAD_DIR)
    check = target
    while not check.exists() and check != check.parent:
        check = check.parent
    try:
        usage = shutil.disk_usage(check)
        return {
            "path": str(target),
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": round((usage.used / usage.total) * 100, 1) if usage.total else 0,
        }
    except OSError:
        return {
            "path": str(target),
            "total": 0,
            "used": 0,
            "free": 0,
            "percent": 0,
        }


def server_info(request=None) -> dict:
    lan_ip = get_lan_ip()
    hostname = socket.gethostname()
    scheme = "https" if request and request.is_secure() else "http"
    port = settings.PORT
    current_url = request.build_absolute_uri("/") if request else f"{scheme}://{lan_ip}:{port}/"
    return {
        "hostname": hostname,
        "lan_ip": lan_ip,
        "port": port,
        "lan_url": f"http://{lan_ip}:{port}/",
        "current_url": current_url,
        "scheme": scheme,
        "os": _system_name(),
        "kernel": platform.release(),
        "python_version": platform.python_version(),
        "django_version": django.get_version(),
        "version": settings.APP_VERSION,
        "time_zone": settings.TIME_ZONE,
        "server_uptime_seconds": server_uptime_seconds(),
        "process_uptime_seconds": process_uptime_seconds(),
        "pid": os.getpid(),
        "lan_only": settings.SEEDSTATION_LAN_ONLY,
        "qbit_webui": f"http://{settings.QBIT_HOST}:{settings.QBIT_PORT}",
        "time": datetime.now(UTC).isoformat(),
    }


def firewall_hint() -> str | None:
    """Return a safe, read-only hint about common firewall tools."""
    for client, hint in (
        (
            "firewall-cmd",
            f"sudo firewall-cmd --permanent --zone=home --add-port={settings.PORT}/tcp",
        ),
        (
            "ufw",
            f"sudo ufw allow from 192.168.0.0/16 to any port {settings.PORT} proto tcp",
        ),
    ):
        if shutil.which(client):
            return hint
    return None


def read_os_release() -> dict[str, str]:
    data: dict[str, str] = {}
    try:
        for line in Path("/etc/os-release").read_text(encoding="utf-8").splitlines():
            if "=" in line:
                key, value = line.split("=", 1)
                data[key] = value.strip().strip('"')
    except OSError:
        pass
    return data
