from __future__ import annotations

import json

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client

pytestmark = pytest.mark.django_db


def login_payload(username="tester", password="correct-horse-battery-staple"):
    return json.dumps({"username": username, "password": password})


def test_session_endpoint_sets_csrf(client):
    response = client.get("/api/auth/session/")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is False
    assert data["user"] is None
    assert data["csrfToken"]
    assert settings.CSRF_COOKIE_NAME in response.cookies


def test_login_rejects_wrong_password(client, user):
    response = client.post(
        "/api/auth/login/",
        data=login_payload(password="wrong-password"),
        content_type="application/json",
    )
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


def test_login_and_session(client, user):
    response = client.post(
        "/api/auth/login/",
        data=login_payload(),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert response.json()["user"]["username"] == "tester"
    session = client.get("/api/auth/session/").json()
    assert session["authenticated"] is True
    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.json()["user"]["username"] == "tester"


def test_login_is_rate_limited(client, user):
    for _ in range(settings.LOGIN_MAX_ATTEMPTS):
        response = client.post(
            "/api/auth/login/",
            data=login_payload(password="wrong-password"),
            content_type="application/json",
        )
        assert response.status_code == 401
    limited = client.post(
        "/api/auth/login/",
        data=login_payload(),
        content_type="application/json",
    )
    assert limited.status_code == 429
    assert limited["Retry-After"]


def test_login_requires_csrf_when_enforced(user):
    client = Client(enforce_csrf_checks=True)
    session = client.get("/api/auth/session/")
    assert session.status_code == 200
    missing = client.post(
        "/api/auth/login/",
        data=login_payload(),
        content_type="application/json",
    )
    assert missing.status_code == 403
    token = session.cookies[settings.CSRF_COOKIE_NAME].value
    success = client.post(
        "/api/auth/login/",
        data=login_payload(),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert success.status_code == 200
    assert success.json()["authenticated"] is True


def test_logout(auth_client):
    response = auth_client.post("/api/auth/logout/")
    assert response.status_code == 200
    assert response.json()["authenticated"] is False
    assert auth_client.get("/api/auth/session/").json()["authenticated"] is False


def test_password_change(auth_client, user):
    response = auth_client.post(
        "/api/auth/password/",
        data=json.dumps(
            {
                "current_password": "correct-horse-battery-staple",
                "new_password": "a-new-longer-passphrase-42",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("a-new-longer-passphrase-42")


def test_password_change_rejects_weak(auth_client, user):
    response = auth_client.post(
        "/api/auth/password/",
        data=json.dumps(
            {
                "current_password": "correct-horse-battery-staple",
                "new_password": "password",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 400
    user.refresh_from_db()
    assert user.check_password("correct-horse-battery-staple")


def test_protected_endpoint_requires_auth(client, download_root):
    response = client.get("/api/files/roots/")
    assert response.status_code in {401, 403}


def test_non_lan_host_is_rejected(client):
    response = client.get("/api/health/", HTTP_HOST="evil.example.com")
    assert response.status_code == 400
    assert response.json()["code"] == "host_not_allowed"


def test_health_is_available_without_auth(client):
    response = client.get("/api/health/", HTTP_HOST="127.0.0.1")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
