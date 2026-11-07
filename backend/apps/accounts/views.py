from __future__ import annotations

import json
import logging
from json import JSONDecodeError

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from apps.core.models import AuditEvent

from .services import (
    clear_login_failures,
    client_ip,
    is_login_limited,
    now_iso,
    record_login_failure,
    session_payload,
    user_payload,
)

logger = logging.getLogger(__name__)


def _json_body(request) -> dict:
    try:
        body = json.loads(request.body or b"{}")
    except (JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Malformed JSON request.") from exc
    if not isinstance(body, dict):
        raise ValueError("Expected a JSON object.")
    return body


def _error(detail: str, status: int = 400, code: str = "invalid_request", **extra):
    payload = {"detail": detail, "code": code}
    payload.update(extra)
    response = JsonResponse(payload, status=status)
    response["Cache-Control"] = "no-store"
    return response


def _session_response(request, user=None):
    authenticated = bool(user and user.is_authenticated)
    response = JsonResponse(
        {
            "authenticated": authenticated,
            "user": session_payload(user) if authenticated else None,
            "csrfToken": get_token(request),
            "serverTime": now_iso(),
            "version": settings.APP_VERSION,
        }
    )
    response["Cache-Control"] = "no-store"
    return response


@never_cache
@require_GET
@ensure_csrf_cookie
def session_view(request):
    """Bootstrap endpoint: also guarantees the CSRF cookie is present."""
    return _session_response(request, request.user)


@never_cache
@require_POST
@csrf_protect
@ensure_csrf_cookie
def login_view(request):
    if request.content_type and "application/json" not in request.content_type:
        return _error("Send the login as JSON.", 415, "unsupported_media_type")
    try:
        body = _json_body(request)
    except ValueError as exc:
        return _error(str(exc))

    username = body.get("username")
    password = body.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return _error("Username and password are required.", 400, "missing_credentials")
    username = username.strip()
    if not username or len(username) > 150:
        return _error("Invalid username or password.", 401, "invalid_credentials")
    if len(password) > 4096:
        return _error("Invalid username or password.", 401, "invalid_credentials")

    ip = client_ip(request)
    if is_login_limited(ip, username):
        response = _error(
            "Too many attempts. Try again in a few minutes.", 429, "rate_limited"
        )
        response["Retry-After"] = str(settings.LOGIN_LOCKOUT_SECONDS)
        return response

    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        record_login_failure(ip, username)
        AuditEvent.objects.create(
            event="auth.login_failed",
            ip_address=ip,
            metadata={"username": username[:150]},
        )
        return _error("Invalid username or password.", 401, "invalid_credentials")

    clear_login_failures(ip, username)
    login(request, user)
    get_token(request)  # rotate and expose the post-login CSRF token
    AuditEvent.objects.create(
        event="auth.login",
        actor=user,
        ip_address=ip,
        metadata={"user_agent": request.META.get("HTTP_USER_AGENT", "")[:300]},
    )
    response = JsonResponse(
        {
            "authenticated": True,
            "user": user_payload(user),
            "csrfToken": get_token(request),
            "serverTime": now_iso(),
        }
    )
    response["Cache-Control"] = "no-store"
    return response


@never_cache
@require_POST
@csrf_protect
@ensure_csrf_cookie
def logout_view(request):
    if request.user.is_authenticated:
        AuditEvent.objects.create(
            event="auth.logout",
            actor=request.user,
            ip_address=client_ip(request),
        )
        logout(request)
    get_token(request)
    response = JsonResponse(
        {
            "authenticated": False,
            "user": None,
            "csrfToken": get_token(request),
            "serverTime": now_iso(),
        }
    )
    response["Cache-Control"] = "no-store"
    return response


@never_cache
@require_GET
def me_view(request):
    if not request.user.is_authenticated:
        return _error("Authentication required.", 401, "not_authenticated")
    response = JsonResponse({"user": session_payload(request.user), "serverTime": now_iso()})
    response["Cache-Control"] = "no-store"
    return response


@never_cache
@require_POST
@csrf_protect
def password_change_view(request):
    if not request.user.is_authenticated:
        return _error("Authentication required.", 401, "not_authenticated")
    try:
        body = _json_body(request)
    except ValueError as exc:
        return _error(str(exc))

    current = body.get("current_password")
    new_password = body.get("new_password")
    if not isinstance(current, str) or not isinstance(new_password, str):
        return _error("Current and new passwords are required.", 400, "missing_fields")
    if not request.user.check_password(current):
        AuditEvent.objects.create(
            event="auth.password_change_failed",
            actor=request.user,
            ip_address=client_ip(request),
        )
        return _error("Current password is incorrect.", 400, "invalid_password")
    try:
        validate_password(new_password, user=request.user)
    except ValidationError as exc:
        return _error(" ".join(exc.messages), 400, "weak_password")
    if current == new_password:
        return _error("Choose a password different from the current one.", 400, "same_password")

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    update_session_auth_hash(request, request.user)
    AuditEvent.objects.create(
        event="auth.password_changed",
        actor=request.user,
        ip_address=client_ip(request),
    )
    response = JsonResponse(
        {"detail": "Password updated.", "csrfToken": get_token(request)}
    )
    response["Cache-Control"] = "no-store"
    return response
