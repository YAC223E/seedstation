"""LAN host validation and browser security headers."""

from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urlsplit

from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def _hostname_from_host_header(value: str) -> str:
    try:
        parsed = urlsplit(f"//{value}")
        return (parsed.hostname or "").lower().strip(".")
    except ValueError:
        return ""


def is_private_host(hostname: str) -> bool:
    if not hostname:
        return False
    if hostname in {"localhost", "testserver"}:
        return True
    if hostname.endswith(".local"):
        return True
    try:
        hostname.encode("idna")
    except UnicodeError:
        return False
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return False
    return bool(ip.is_private or ip.is_loopback or ip.is_link_local)


def origin_is_allowed(origin: str, host: str) -> bool:
    """Validate a WebSocket Origin against the request host and dev origins."""
    if not origin:
        return True
    try:
        parsed = urlsplit(origin)
    except ValueError:
        return False
    if not parsed.scheme or not parsed.hostname:
        return False
    request_host = _hostname_from_host_header(host)
    origin_host = parsed.hostname.lower().strip(".")
    if origin_host == request_host:
        return True
    current_origin = f"{parsed.scheme}://{parsed.netloc}"
    if current_origin in settings.CSRF_TRUSTED_ORIGINS:
        return True
    if current_origin in settings.CORS_ALLOWED_ORIGINS:
        return True
    # Sibling LAN origins on the same private host (for a reverse-proxied
    # deployment) are not automatically trusted; only exact origins above.
    return False


class LANHostMiddleware:
    """Allow loopback, private LAN IPs and .local hosts by default.

    Django's ALLOWED_HOSTS is intentionally set to ``*`` so DHCP address
    changes do not break the app. This middleware performs the real check.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            host_value = request.get_host()
        except Exception:  # DisallowedHost from a malformed header
            return JsonResponse(
                {"detail": "Invalid Host header.", "code": "invalid_host"},
                status=400,
            )

        hostname = _hostname_from_host_header(host_value)
        configured = {
            item.lower().strip().strip("[]")
            for item in settings.SEEDSTATION_EXTRA_ALLOWED_HOSTS
        }
        allowed = (
            not settings.SEEDSTATION_LAN_ONLY
            or is_private_host(hostname)
            or hostname in configured
            or (getattr(settings, "SEEDSTATION_TESTING", False) and hostname == "testserver")
        )
        if not allowed:
            logger.warning("Rejected non-LAN Host header: %s", host_value)
            return JsonResponse(
                {
                    "detail": "SeedStation only accepts requests from the local network. "
                    "Add this hostname to SEEDSTATION_ALLOWED_HOSTS if you are using a reverse proxy.",
                    "code": "host_not_allowed",
                },
                status=400,
            )

        return self.get_response(request)


class SecurityHeadersMiddleware:
    """Apply headers that Django does not provide out of the box."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path
        if not path.startswith("/admin/"):
            response.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; "
                "base-uri 'self'; "
                "object-src 'none'; "
                "frame-ancestors 'none'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self' data:; "
                "media-src 'self' blob:; "
                "frame-src 'self' blob:; "
                "connect-src 'self' ws: wss:; "
                "worker-src 'self' blob:;",
            )
            response.setdefault(
                "Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
            )
            response.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "same-origin")
        return response


def local_hostname() -> str:
    return socket.gethostname()
