from __future__ import annotations

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone


def client_ip(request) -> str:
    # Deliberately ignore X-Forwarded-For: SeedStation is a LAN service and
    # does not trust proxy headers by default.
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _keys(ip: str, username: str | None = None) -> list[str]:
    keys = [f"seedstation:login:ip:{ip}"]
    if username:
        keys.append(f"seedstation:login:user:{username.casefold()[:150]}")
    return keys


def is_login_limited(ip: str, username: str | None = None) -> bool:
    limit = settings.LOGIN_MAX_ATTEMPTS
    return any((cache.get(key) or 0) >= limit for key in _keys(ip, username))


def record_login_failure(ip: str, username: str | None = None) -> None:
    timeout = settings.LOGIN_LOCKOUT_SECONDS
    for key in _keys(ip, username):
        try:
            cache.add(key, 0, timeout=timeout)
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, timeout=timeout)


def clear_login_failures(ip: str, username: str | None = None) -> None:
    for key in _keys(ip, username):
        cache.delete(key)


def user_payload(user) -> dict:
    return {
        "id": user.pk,
        "username": user.get_username(),
        "email": user.email,
        "is_staff": user.is_staff,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
    }


def session_payload(user) -> dict:
    return {
        "id": user.pk,
        "username": user.get_username(),
        "email": user.email,
        "is_staff": user.is_staff,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def now_iso() -> str:
    return timezone.now().isoformat()
