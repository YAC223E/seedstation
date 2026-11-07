from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "path",
    [
        "/assets/missing.js",
        "/assets/nested/missing.css",
        "/static/missing.css",
        "/missing.webmanifest",
    ],
)
def test_missing_static_assets_return_404(client, path):
    """A missing build artifact must not be redirected into the SPA shell."""

    response = client.get(path)

    assert response.status_code == 404
    assert not response.get("Location")


def test_spa_route_falls_back_to_index(client):
    """Client-side routes without a file extension render the Vite entrypoint."""

    response = client.get("/downloads")

    assert response.status_code in {200, 503}
    assert response["Content-Type"].startswith("text/html")
    assert b"<div id=\"root\">" in response.content or b"frontend build was not found" in response.content


def test_unknown_api_route_is_not_spa(client):
    response = client.get("/api/does-not-exist/")

    assert response.status_code == 404
    assert not response["Content-Type"].startswith("text/html") or b"<div id=\"root\">" not in response.content
