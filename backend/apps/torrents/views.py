from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import AuditEvent

from . import engine, service
from .engine import EngineError
from .live import collect_live_snapshot
from .service import (
    add_magnet,
    add_torrent_file,
    delete_torrent,
    get_torrent_or_404,
    safe_hash,
)

logger = logging.getLogger(__name__)


def _engine_response(exc: EngineError) -> Response:
    return Response(
        {"detail": str(exc), "code": exc.code},
        status=getattr(exc, "status_code", 503),
    )


def _bool(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class MagnetSerializer(serializers.Serializer):
    magnet = serializers.CharField(max_length=8192, trim_whitespace=True)
    save_path = serializers.CharField(max_length=1024, required=False, allow_blank=False)
    start_paused = serializers.BooleanField(required=False)


class UploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    save_path = serializers.CharField(max_length=1024, required=False, allow_blank=False)
    start_paused = serializers.BooleanField(required=False)


class DeleteSerializer(serializers.Serializer):
    confirm = serializers.CharField(max_length=16)
    delete_files = serializers.BooleanField(default=False)


class TorrentListView(APIView):
    def get(self, request):
        try:
            torrents = engine.get_torrents()
            info = engine.get_engine_info()
        except EngineError as exc:
            return _engine_response(exc)
        return Response({"torrents": torrents, "engine": info})


class TorrentDetailView(APIView):
    def get(self, request, torrent_hash: str):
        try:
            detail = engine.get_torrent_detail(safe_hash(torrent_hash))
        except EngineError as exc:
            return _engine_response(exc)
        return Response(detail)

    def delete(self, request, torrent_hash: str):
        serializer = DeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["confirm"] != "DELETE":
            return Response(
                {
                    "detail": 'Type DELETE to confirm torrent removal.',
                    "code": "confirmation_required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        torrent_hash = safe_hash(torrent_hash)
        try:
            torrent = delete_torrent(
                torrent_hash, serializer.validated_data["delete_files"]
            )
        except EngineError as exc:
            return _engine_response(exc)
        AuditEvent.objects.create(
            event="torrent.deleted",
            actor=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
            metadata={
                "hash": torrent_hash,
                "name": torrent.get("name", "")[:300],
                "delete_files": serializer.validated_data["delete_files"],
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MagnetAddView(APIView):
    def post(self, request):
        serializer = MagnetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            torrent = add_magnet(
                data["magnet"],
                data.get("save_path"),
                data.get("start_paused"),
            )
        except EngineError as exc:
            return _engine_response(exc)
        AuditEvent.objects.create(
            event="torrent.added",
            actor=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
            metadata={"hash": torrent["hash"], "name": torrent["name"][:300], "source": "magnet"},
        )
        return Response(
            {"detail": "Magnet added to the engine.", "torrent": torrent},
            status=status.HTTP_201_CREATED,
        )


class TorrentUploadView(APIView):
    def post(self, request):
        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]
        if upload.size > settings.MAX_TORRENT_FILE_SIZE:
            return Response(
                {"detail": "Torrent files must be smaller than 10 MB.", "code": "file_too_large"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        data = upload.read(settings.MAX_TORRENT_FILE_SIZE + 1)
        if len(data) > settings.MAX_TORRENT_FILE_SIZE:
            return Response(
                {"detail": "Torrent files must be smaller than 10 MB.", "code": "file_too_large"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        try:
            torrent = add_torrent_file(
                data,
                upload.name or "uploaded.torrent",
                serializer.validated_data.get("save_path"),
                serializer.validated_data.get("start_paused"),
            )
        except EngineError as exc:
            return _engine_response(exc)
        AuditEvent.objects.create(
            event="torrent.added",
            actor=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
            metadata={"hash": torrent["hash"], "name": torrent["name"][:300], "source": "file"},
        )
        return Response(
            {"detail": "Torrent file added to the engine.", "torrent": torrent},
            status=status.HTTP_201_CREATED,
        )


class TorrentPauseView(APIView):
    def post(self, request, torrent_hash: str):
        torrent_hash = safe_hash(torrent_hash)
        try:
            engine.pause_torrent(torrent_hash)
        except EngineError as exc:
            return _engine_response(exc)
        return Response({"detail": "Torrent paused.", "hash": torrent_hash})


class TorrentResumeView(APIView):
    def post(self, request, torrent_hash: str):
        torrent_hash = safe_hash(torrent_hash)
        try:
            engine.resume_torrent(torrent_hash)
        except EngineError as exc:
            return _engine_response(exc)
        return Response({"detail": "Torrent resumed.", "hash": torrent_hash})


class TorrentRecheckView(APIView):
    def post(self, request, torrent_hash: str):
        torrent_hash = safe_hash(torrent_hash)
        try:
            engine.recheck_torrent(torrent_hash)
        except EngineError as exc:
            return _engine_response(exc)
        return Response({"detail": "Torrent queued for recheck.", "hash": torrent_hash})


class LiveView(APIView):
    def get(self, request):
        response = Response(collect_live_snapshot(record=True))
        response["Cache-Control"] = "no-store"
        return response
