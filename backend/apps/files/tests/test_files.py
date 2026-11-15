from __future__ import annotations

import io
import json
import os
import zipfile
from pathlib import Path

import pytest
from asgiref.sync import async_to_sync
from django.test import Client

from apps.files.streaming import async_byte_stream

pytestmark = pytest.mark.django_db


def collect_stream(response):
    async def collect():
        return b"".join([chunk async for chunk in response.streaming_content])

    return async_to_sync(collect)()


def test_async_byte_stream_is_lazy():
    """Django's ASGI handler must not materialize a whole file into a list."""
    consumed = []

    def chunks():
        for index in range(5):
            consumed.append(index)
            yield bytes([index])

    async def first_chunk():
        async for chunk in async_byte_stream(chunks()):
            return chunk

    assert async_to_sync(first_chunk)() == b"\x00"
    assert consumed == [0]


def make_files(root: Path):
    (root / "hello.txt").write_text("hello from seedstation\n", encoding="utf-8")
    media = root / "Show"
    media.mkdir()
    (media / "episode one.mp4").write_bytes(b"0123456789" * 100)
    (media / "notes.srt").write_text("1\n00:00 --> 00:01\nHi\n", encoding="utf-8")
    (media / "empty").mkdir()


def test_roots(auth_client, download_root):
    make_files(download_root)
    response = auth_client.get("/api/files/roots/")
    assert response.status_code == 200
    data = response.json()
    assert data["roots"][0]["path"] == str(download_root)
    assert data["roots"][0]["free"] > 0


def test_listing(auth_client, download_root):
    make_files(download_root)
    data = auth_client.get("/api/files/").json()
    assert data["path"] == str(download_root)
    names = [entry["name"] for entry in data["entries"]]
    assert names[0] == "Show"
    assert "hello.txt" in names
    assert data["file_count"] == 1
    assert data["directory_count"] == 1


def test_directory_traversal_rejected(auth_client, download_root):
    response = auth_client.get("/api/files/", {"path": str(download_root / ".." / ".." / "etc")})
    assert response.status_code in {403, 404}


def test_absolute_system_path_rejected(auth_client, download_root):
    response = auth_client.get("/api/files/download/", {"path": "/etc/passwd"})
    assert response.status_code == 403
    assert response.json()["code"] == "path_outside_roots"


def test_symlink_escape_rejected(auth_client, download_root, tmp_path):
    outside = tmp_path / "outside.txt"
    outside.write_text("secret", encoding="utf-8")
    link = download_root / "escape.txt"
    link.symlink_to(outside)
    response = auth_client.get("/api/files/download/", {"path": str(link)})
    assert response.status_code == 403
    # The directory listing must not expose the escaping target either.
    listed = auth_client.get("/api/files/").json()
    assert "escape.txt" not in [entry["name"] for entry in listed["entries"]]


def test_range_request(auth_client, download_root):
    media = download_root / "video.bin"
    media.write_bytes(bytes(range(256)) * 4)
    response = auth_client.get(
        "/api/files/download/",
        {"path": str(media), "inline": "1"},
        HTTP_RANGE="bytes=10-19",
    )
    assert response.status_code == 206
    assert response["Content-Range"] == f"bytes 10-19/{media.stat().st_size}"
    assert response["Accept-Ranges"] == "bytes"
    assert collect_stream(response) == bytes(range(10, 20))


def test_suffix_range(auth_client, download_root):
    path = download_root / "tail.bin"
    path.write_bytes(b"abcdefghij")
    response = auth_client.get(
        "/api/files/download/", {"path": str(path)}, HTTP_RANGE="bytes=-3"
    )
    assert response.status_code == 206
    assert collect_stream(response) == b"hij"


def test_invalid_range(auth_client, download_root):
    path = download_root / "short.bin"
    path.write_bytes(b"abcdefghij")
    response = auth_client.get(
        "/api/files/download/", {"path": str(path)}, HTTP_RANGE="bytes=100-200"
    )
    assert response.status_code == 416
    assert response["Content-Range"] == "bytes */10"


def test_head_download(auth_client, download_root):
    path = download_root / "head.bin"
    path.write_bytes(b"0123456789")
    response = auth_client.head("/api/files/download/", {"path": str(path)})
    assert response.status_code == 200
    assert response["Content-Length"] == "10"
    assert response.content == b""


def test_download_filename_headers(auth_client, download_root):
    path = download_root / "Résumé final.txt"
    path.write_text("ok", encoding="utf-8")
    response = auth_client.get("/api/files/download/", {"path": str(path)})
    disposition = response["Content-Disposition"]
    assert disposition.startswith("attachment;")
    assert "filename*=UTF-8''" in disposition
    assert "%C3%A9" in disposition


def test_text_preview(auth_client, download_root):
    path = download_root / "readme.md"
    path.write_text("# Hello\nBody", encoding="utf-8")
    response = auth_client.get("/api/files/text/", {"path": str(path)})
    assert response.status_code == 200
    assert response.json()["content"].startswith("# Hello")


def test_binary_preview_rejected(auth_client, download_root):
    path = download_root / "data.bin"
    path.write_bytes(b"\x00\x01\x02" * 10)
    response = auth_client.get("/api/files/text/", {"path": str(path)})
    assert response.status_code == 415


def test_zip_archive_streams(auth_client, download_root):
    make_files(download_root)
    response = auth_client.get("/api/files/archive/", {"path": str(download_root / "Show")})
    assert response.status_code == 200
    assert response["Content-Type"] == "application/zip"
    body = collect_stream(response)
    archive = zipfile.ZipFile(io.BytesIO(body))
    names = archive.namelist()
    assert "Show/episode one.mp4" in names
    assert "Show/notes.srt" in names
    assert not any(".." in name for name in names)
    assert archive.read("Show/notes.srt").startswith(b"1")


def test_delete_file_requires_confirmation(auth_client, download_root):
    path = download_root / "delete-me.txt"
    path.write_text("x", encoding="utf-8")
    response = auth_client.post(
        "/api/files/delete/",
        data=json.dumps({"path": str(path), "confirm": "nope"}),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert path.exists()


def test_delete_file(auth_client, download_root):
    path = download_root / "delete-me.txt"
    path.write_text("x", encoding="utf-8")
    response = auth_client.post(
        "/api/files/delete/",
        data=json.dumps({"path": str(path), "confirm": "DELETE"}),
        content_type="application/json",
    )
    assert response.status_code == 204
    assert not path.exists()


def test_delete_root_rejected(auth_client, download_root):
    response = auth_client.post(
        "/api/files/delete/",
        data=json.dumps({"path": str(download_root), "confirm": "DELETE", "recursive": True}),
        content_type="application/json",
    )
    assert response.status_code == 403
    assert download_root.exists()


def test_delete_folder_requires_recursive(auth_client, download_root):
    folder = download_root / "folder"
    folder.mkdir()
    (folder / "a.txt").write_text("a", encoding="utf-8")
    response = auth_client.post(
        "/api/files/delete/",
        data=json.dumps({"path": str(folder), "confirm": "DELETE"}),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert folder.exists()
    response = auth_client.post(
        "/api/files/delete/",
        data=json.dumps({"path": str(folder), "confirm": "DELETE", "recursive": True}),
        content_type="application/json",
    )
    assert response.status_code == 204
    assert not folder.exists()


def test_delete_symlink_rejected(auth_client, download_root, tmp_path):
    outside = tmp_path / "outside.txt"
    outside.write_text("secret", encoding="utf-8")
    link = download_root / "link.txt"
    link.symlink_to(outside)
    response = auth_client.post(
        "/api/files/delete/",
        data=json.dumps({"path": str(link), "confirm": "DELETE"}),
        content_type="application/json",
    )
    assert response.status_code == 403
    assert outside.exists()
