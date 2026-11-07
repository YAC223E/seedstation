from __future__ import annotations

import logging
import mimetypes
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

from django.http import StreamingHttpResponse
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from zipstream import ZIP_STORED, ZipStream

from apps.core.models import AuditEvent
from apps.core.paths import (
    PathGuardError,
    configured_roots,
    is_within,
    resolve_path,
)
from apps.core.server import disk_stats

from .streaming import content_disposition, file_stream_response

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic", ".bmp", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi", ".wmv"}
AUDIO_EXTENSIONS = {".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".wma"}
ARCHIVE_EXTENSIONS = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".zst", ".iso"}
DOCUMENT_EXTENSIONS = {".pdf", ".epub", ".doc", ".docx", ".odt", ".xls", ".xlsx", ".ppt", ".pptx"}
TEXT_EXTENSIONS = {".txt", ".md", ".json", ".xml", ".csv", ".log", ".srt", ".vtt", ".nfo", ".yml", ".yaml"}


def _error(exc: PathGuardError) -> Response:
    return Response(
        {"detail": str(exc), "code": exc.code},
        status=getattr(exc, "status_code", 400),
    )


def _guard(fn):
    """Convert PathGuardError into a structured API response."""

    def wrapped(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except PathGuardError as exc:
            return _error(exc)
        except PermissionError:
            return Response(
                {"detail": "Permission denied by the filesystem.", "code": "permission_denied"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except FileNotFoundError:
            return Response(
                {"detail": "The requested file or folder no longer exists.", "code": "not_found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    return wrapped


def _category(path: Path, *, is_dir: bool) -> str:
    if is_dir:
        return "folder"
    ext = path.suffix.lower()
    mime, _ = mimetypes.guess_type(path.name)
    mime = mime or ""
    if ext in IMAGE_EXTENSIONS or mime.startswith("image/"):
        return "image"
    if ext in VIDEO_EXTENSIONS or mime.startswith("video/"):
        return "video"
    if ext in AUDIO_EXTENSIONS or mime.startswith("audio/"):
        return "audio"
    if ext in ARCHIVE_EXTENSIONS:
        return "archive"
    if ext in DOCUMENT_EXTENSIONS or mime == "application/pdf":
        return "document"
    if ext in TEXT_EXTENSIONS or mime.startswith("text/"):
        return "text"
    return "other"


def _entry(path: Path, *, root: Path, is_dir: bool, size: int, modified: float) -> dict:
    mime, _ = mimetypes.guess_type(path.name) if not is_dir else ("inode/directory", None)
    return {
        "name": path.name,
        "path": str(path),
        "is_dir": is_dir,
        "size": size,
        "modified": datetime.fromtimestamp(modified, tz=UTC).isoformat()
        if modified
        else None,
        "extension": path.suffix.lower().lstrip("."),
        "mime": mime or ("inode/directory" if is_dir else "application/octet-stream"),
        "category": _category(path, is_dir=is_dir),
    }


def _breadcrumbs(path: Path, root: Path) -> list[dict]:
    crumbs = [{"name": root.name or str(root), "path": str(root)}]
    try:
        relative = path.relative_to(root)
    except ValueError:
        return crumbs
    current = root
    for part in relative.parts:
        current = current / part
        crumbs.append({"name": part, "path": str(current)})
    return crumbs


class RootsView(APIView):
    def get(self, request):
        roots = configured_roots()
        payload = []
        for root in roots:
            exists = root.is_dir()
            stats = disk_stats(root)
            payload.append(
                {
                    "name": root.name or str(root),
                    "path": str(root),
                    "exists": exists,
                    "total": stats["total"],
                    "used": stats["used"],
                    "free": stats["free"],
                    "percent": stats["percent"],
                }
            )
        response = Response({"roots": payload})
        response["Cache-Control"] = "no-store"
        return response


class FileListView(APIView):
    def get(self, request):
        raw_path = request.query_params.get("path")
        roots = [root for root in configured_roots() if root.is_dir()]
        if not roots:
            return Response(
                {
                    "detail": "No configured download directory exists. Add one in Settings.",
                    "code": "no_download_roots",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not raw_path:
            raw_path = str(roots[0])
        try:
            path, root = resolve_path(raw_path)
        except PathGuardError as exc:
            return _error(exc)
        if not path.is_dir():
            return Response(
                {"detail": "That path is a file, not a folder.", "code": "not_a_directory"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entries = []
        try:
            with os.scandir(path) as iterator:
                for entry in iterator:
                    try:
                        entry_path = Path(entry.path)
                        if entry.is_symlink():
                            target = entry_path.resolve(strict=True)
                            if not is_within(target, root):
                                logger.warning("Skipping symlink escaping download root: %s", entry.path)
                                continue
                        stat = entry.stat(follow_symlinks=True)
                        is_dir = entry.is_dir(follow_symlinks=True)
                        if not (is_dir or entry.is_file(follow_symlinks=True)):
                            continue
                        entries.append(
                            _entry(
                                entry_path,
                                root=root,
                                is_dir=is_dir,
                                size=0 if is_dir else stat.st_size,
                                modified=stat.st_mtime,
                            )
                        )
                    except (OSError, RuntimeError):
                        continue
        except PermissionError:
            return Response(
                {"detail": "Permission denied while reading that folder.", "code": "permission_denied"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except OSError:
            return Response(
                {"detail": "That folder could not be read.", "code": "read_failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entries.sort(key=lambda item: (not item["is_dir"], item["name"].casefold()))
        files = sum(1 for item in entries if not item["is_dir"])
        dirs = sum(1 for item in entries if item["is_dir"])
        payload = {
            "path": str(path),
            "root": {"name": root.name or str(root), "path": str(root)},
            "breadcrumbs": _breadcrumbs(path, root),
            "parent": str(path.parent) if path != root else None,
            "entries": entries,
            "file_count": files,
            "directory_count": dirs,
            "disk": disk_stats(root),
        }
        response = Response(payload)
        response["Cache-Control"] = "no-store"
        return response


class DownloadView(APIView):
    def get(self, request):
        raw_path = request.query_params.get("path")
        if not raw_path:
            return Response(
                {"detail": "A file path is required.", "code": "missing_path"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            path, _ = resolve_path(raw_path)
        except PathGuardError as exc:
            return _error(exc)
        if not path.is_file():
            return Response(
                {"detail": "That path is not a file.", "code": "not_a_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        inline = request.query_params.get("inline") in {"1", "true", "yes"}
        return file_stream_response(request, path, inline=inline)

    def head(self, request):
        return self.get(request)


def _zip_name(path: Path) -> str:
    return f"{path.name or 'download'}.zip"


def _safe_zip_relative(path: Path) -> str:
    return path.as_posix().lstrip("/")


class ArchiveView(APIView):
    def get(self, request):
        raw_path = request.query_params.get("path")
        if not raw_path:
            return Response(
                {"detail": "A folder path is required.", "code": "missing_path"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            path, root = resolve_path(raw_path)
        except PathGuardError as exc:
            return _error(exc)
        if not path.is_dir():
            return Response(
                {"detail": "Only folders can be archived.", "code": "not_a_directory"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        archive_root = path.name or "download"
        stream = ZipStream(compress_type=ZIP_STORED)
        file_count = 0
        try:
            stream.mkdir(f"{archive_root}/")
            for current, dirnames, filenames in os.walk(path, followlinks=False):
                current_path = Path(current)
                dirnames[:] = sorted(
                    [
                        name
                        for name in dirnames
                        if not (current_path / name).is_symlink()
                    ],
                    key=str.casefold,
                )
                if current_path != path:
                    relative_dir = _safe_zip_relative(current_path.relative_to(path))
                    stream.mkdir(f"{archive_root}/{relative_dir}/")
                for filename in sorted(filenames, key=str.casefold):
                    file_path = current_path / filename
                    if file_path.is_symlink() or not file_path.is_file():
                        continue
                    relative = _safe_zip_relative(file_path.relative_to(path))
                    try:
                        stream.add_path(
                            file_path,
                            arcname=f"{archive_root}/{relative}",
                            recurse=False,
                        )
                        file_count += 1
                    except (OSError, PermissionError):
                        logger.warning("Skipping unreadable file in archive: %s", file_path)
        except (OSError, PermissionError) as exc:
            logger.warning("Archive walk failed for %s: %s", path, exc)
            return Response(
                {"detail": "That folder could not be archived.", "code": "archive_failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = StreamingHttpResponse(stream, content_type="application/zip")
        response["Content-Disposition"] = content_disposition(_zip_name(path), inline=False)
        response["Cache-Control"] = "no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class TextView(APIView):
    MAX_BYTES = 512 * 1024

    def get(self, request):
        raw_path = request.query_params.get("path")
        if not raw_path:
            return Response(
                {"detail": "A file path is required.", "code": "missing_path"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            path, _ = resolve_path(raw_path)
        except PathGuardError as exc:
            return _error(exc)
        if not path.is_file():
            return Response(
                {"detail": "That path is not a file.", "code": "not_a_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mime, _ = mimetypes.guess_type(path.name)
        mime = mime or "application/octet-stream"
        allowed = mime.startswith("text/") or mime in {
            "application/json",
            "application/xml",
            "application/javascript",
            "application/x-sh",
            "application/x-python",
            "application/x-yaml",
        }
        if not allowed:
            return Response(
                {"detail": "This file type is not previewable as text.", "code": "unsupported_preview"},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        with open(path, "rb") as handle:
            data = handle.read(self.MAX_BYTES + 1)
        truncated = len(data) > self.MAX_BYTES
        data = data[: self.MAX_BYTES]
        if b"\x00" in data[:4096]:
            return Response(
                {"detail": "This file appears to be binary.", "code": "binary_file"},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            content = data.decode("latin-1", errors="replace")
        return Response(
            {
                "path": str(path),
                "name": path.name,
                "mime": mime,
                "size": path.stat().st_size,
                "content": content,
                "truncated": truncated,
            }
        )


class DeleteSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=4096)
    confirm = serializers.CharField(max_length=16)
    recursive = serializers.BooleanField(default=False)


class DeleteView(APIView):
    def post(self, request):
        serializer = DeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["confirm"] != "DELETE":
            return Response(
                {"detail": "Deletion requires explicit confirmation.", "code": "confirmation_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw = serializer.validated_data["path"]
        roots = configured_roots()
        requested = Path(raw).expanduser()
        if requested.is_symlink():
            return Response(
                {"detail": "Refusing to delete a symbolic link.", "code": "symlink_delete_rejected"},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            path, _ = resolve_path(raw)
        except PathGuardError as exc:
            return _error(exc)
        if any(path == root for root in roots):
            return Response(
                {"detail": "The download root itself cannot be deleted.", "code": "root_delete_rejected"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if path.is_dir():
            if not serializer.validated_data["recursive"]:
                return Response(
                    {
                        "detail": "Deleting a folder requires recursive confirmation.",
                        "code": "recursive_required",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                shutil.rmtree(path)
            except OSError as exc:
                logger.warning("Folder delete failed for %s: %s", path, exc)
                return Response(
                    {"detail": "The folder could not be deleted.", "code": "delete_failed"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            try:
                path.unlink()
            except OSError as exc:
                logger.warning("File delete failed for %s: %s", path, exc)
                return Response(
                    {"detail": "The file could not be deleted.", "code": "delete_failed"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        AuditEvent.objects.create(
            event="file.deleted",
            actor=request.user,
            ip_address=request.META.get("REMOTE_ADDR"),
            metadata={"path": str(path), "recursive": serializer.validated_data["recursive"]},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
