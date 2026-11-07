from __future__ import annotations

import logging
from pathlib import Path

from django.conf import settings
from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.torrents.engine import EngineError
from apps.torrents.live import collect_live_snapshot
from apps.torrents.service import apply_engine_preferences

from .models import AppSettings, AuditEvent
from .serializers import AppSettingsSerializer
from .server import firewall_hint, server_info

logger = logging.getLogger(__name__)


@require_GET
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok", "version": settings.APP_VERSION})
    except Exception:
        logger.exception("Health check failed")
        return JsonResponse({"status": "unavailable"}, status=503)


def _settings_payload(request, *, sync_warning: str | None = None) -> dict:
    station = AppSettings.get_solo()
    snapshot = collect_live_snapshot(record=False)
    engine = dict(snapshot["engine"])
    engine["webui_url"] = f"http://{settings.QBIT_HOST}:{settings.QBIT_PORT}"
    return {
        "settings": AppSettingsSerializer(station).data,
        "engine": engine,
        "server": server_info(request),
        "storage": snapshot["storage"],
        "summary": snapshot["summary"],
        "firewall_hint": firewall_hint(),
        "sync_warning": sync_warning,
        "limits": {
            "max_speed": 1_000_000_000,
            "max_extra_dirs": 8,
        },
    }


class SettingsView(APIView):
    def get(self, request):
        return Response(_settings_payload(request))

    def patch(self, request):
        station = AppSettings.get_solo()
        serializer = AppSettingsSerializer(station, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        warning = None
        try:
            apply_engine_preferences(AppSettings.get_solo())
        except EngineError as exc:
            warning = (
                "Settings saved, but the torrent engine is offline. They will be "
                f"applied when it reconnects ({exc})."
            )
            logger.warning("Could not apply engine preferences: %s", exc)

        AuditEvent.objects.create(
            event="settings.updated",
            actor=request.user if request.user.is_authenticated else None,
            ip_address=request.META.get("REMOTE_ADDR"),
            metadata={"fields": sorted(request.data.keys())},
        )
        return Response(_settings_payload(request, sync_warning=warning))


class SystemView(APIView):
    def get(self, request):
        snapshot = collect_live_snapshot(record=False)
        return Response(
            {
                "engine": snapshot["engine"],
                "server": server_info(request),
                "storage": snapshot["storage"],
                "summary": snapshot["summary"],
                "firewall_hint": firewall_hint(),
            }
        )


@never_cache
def spa_index(request):
    index = Path(settings.WHITENOISE_ROOT) / "index.html"
    try:
        html = index.read_text(encoding="utf-8")
    except OSError:
        return HttpResponse(
            "<!doctype html><title>SeedStation</title><body style='font-family:system-ui;"
            "background:#0b0d0b;color:#f2f4ec;padding:3rem;line-height:1.6'>"
            "<h1>SeedStation backend is running</h1>"
            "<p>The frontend build was not found. Run <code>npm --prefix frontend run build</code> "
            "or <code>./scripts/setup.sh</code>.</p></body>",
            status=503,
            content_type="text/html; charset=utf-8",
        )
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response


def static_not_found(request):
    """Return a real 404 for missing build assets instead of the SPA shell.

    WhiteNoise serves existing files before Django sees the request. Without
    this catch-all, Django's APPEND_SLASH middleware redirects a missing
    ``/assets/foo.js`` to ``/assets/foo.js/`` and the SPA fallback answers with
    HTML under a 200, which breaks asset loading and caching.
    """
    return HttpResponse(status=404)


# status import kept for readability of explicit status codes in this module
_ = status
