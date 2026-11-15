"""Range-aware file streaming for large downloads and iOS Safari previews."""

from __future__ import annotations

import asyncio
import mimetypes
import os
import re
from email.utils import formatdate, parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote

from django.http import HttpResponse, StreamingHttpResponse

CHUNK_SIZE = 128 * 1024

EXTRA_MIME_TYPES = {
    ".mkv": "video/x-matroska",
    ".m4v": "video/mp4",
    ".flac": "audio/flac",
    ".opus": "audio/ogg",
    ".webm": "video/webm",
    ".epub": "application/epub+zip",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
    ".zst": "application/zstd",
    ".srt": "text/plain; charset=utf-8",
    ".vtt": "text/vtt; charset=utf-8",
    ".nfo": "text/plain; charset=utf-8",
    ".iso": "application/x-iso9660-image",
    ".apk": "application/vnd.android.package-archive",
}

for _extension, _mime in EXTRA_MIME_TYPES.items():
    mimetypes.add_type(_mime.split(";")[0], _extension)


class RangeNotSatisfiable(Exception):
    def __init__(self, size: int):
        self.size = size
        super().__init__("Requested range is not satisfiable.")


def content_type_for(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    if path.suffix.lower() in EXTRA_MIME_TYPES:
        return EXTRA_MIME_TYPES[path.suffix.lower()]
    return guessed or "application/octet-stream"


def content_disposition(filename: str, inline: bool) -> str:
    disposition = "inline" if inline else "attachment"
    cleaned = re.sub(r"[\r\n\"\\/]", "_", filename)
    ascii_fallback = cleaned.encode("ascii", "ignore").decode("ascii") or "download"
    ascii_fallback = ascii_fallback[:180]
    return f"{disposition}; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


def _iter_file(path: Path, start: int, length: int):
    with open(path, "rb") as handle:
        handle.seek(start)
        remaining = length
        while remaining > 0:
            chunk = handle.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


async def async_byte_stream(iterable):
    """Yield bytes from a sync iterator without materializing it in memory.

    Django's ASGI handler converts a plain sync iterator into a list, which
    makes the server hold an entire file in RAM. An async iterator keeps the
    transfer streaming, so a slow phone only costs a few chunks of memory.
    """
    iterator = iter(iterable)
    while True:
        chunk = await asyncio.to_thread(next, iterator, None)
        if chunk is None:
            break
        yield chunk


def _parse_range(header: str, size: int) -> tuple[int, int] | None:
    if not header or not header.startswith("bytes=") or "," in header:
        return None
    spec = header[6:].strip()
    if "-" not in spec:
        return None
    start_raw, end_raw = spec.split("-", 1)
    try:
        if start_raw == "":
            suffix = int(end_raw)
            if suffix <= 0:
                raise RangeNotSatisfiable(size)
            start = max(0, size - suffix)
            end = size - 1
        else:
            start = int(start_raw)
            end = int(end_raw) if end_raw else size - 1
    except ValueError:
        return None
    if start < 0 or start >= size or end < start:
        raise RangeNotSatisfiable(size)
    return start, min(end, size - 1)


def _etag(stat: os.stat_result) -> str:
    return f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'


def _if_range_matches(header: str | None, etag: str, stat: os.stat_result) -> bool:
    if not header:
        return True
    header = header.strip()
    if header.startswith('"') or header.startswith("W/"):
        return header == etag
    try:
        parsed = parsedate_to_datetime(header)
        return parsed.timestamp() >= int(stat.st_mtime)
    except (TypeError, ValueError, OverflowError):
        return False


def file_stream_response(request, path: Path, *, inline: bool = False) -> HttpResponse:
    stat = path.stat()
    if not path.is_file():
        raise FileNotFoundError(str(path))
    size = stat.st_size
    etag = _etag(stat)
    content_type = content_type_for(path)
    filename = path.name
    if_none_match = request.headers.get("If-None-Match")
    if if_none_match and if_none_match == etag and not request.headers.get("Range"):
        response = HttpResponse(status=304)
        response["ETag"] = etag
        response["Last-Modified"] = formatdate(stat.st_mtime, usegmt=True)
        return response

    range_header = request.headers.get("Range")
    if not _if_range_matches(request.headers.get("If-Range"), etag, stat):
        range_header = None

    try:
        selected = _parse_range(range_header, size) if range_header else None
    except RangeNotSatisfiable:
        response = HttpResponse(status=416)
        response["Content-Range"] = f"bytes */{size}"
        response["Accept-Ranges"] = "bytes"
        response["Content-Length"] = "0"
        return response

    if selected:
        start, end = selected
        length = end - start + 1
        status_code = 206
        content_range = f"bytes {start}-{end}/{size}"
    else:
        start, end, length = 0, max(0, size - 1), size
        status_code = 200
        content_range = None

    headers = {
        "Content-Type": content_type,
        "Content-Length": str(length),
        "Content-Disposition": content_disposition(filename, inline),
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "Last-Modified": formatdate(stat.st_mtime, usegmt=True),
        "Cache-Control": "private, max-age=0, must-revalidate",
    }
    if content_range:
        headers["Content-Range"] = content_range
    if inline:
        # Previewed PDFs/images may be embedded in the SeedStation origin. The
        # document itself is framed only by our own UI, never by a third party.
        headers["X-Frame-Options"] = "SAMEORIGIN"
        headers["Content-Security-Policy"] = "frame-ancestors 'self'; object-src 'none'"

    if request.method == "HEAD":
        response = HttpResponse(status=status_code)
        for key, value in headers.items():
            response[key] = value
        return response

    response = StreamingHttpResponse(
        async_byte_stream(_iter_file(path, start, length)),
        status=status_code,
        content_type=content_type,
    )
    for key, value in headers.items():
        if key.lower() != "content-type":
            response[key] = value
    return response
