"""Django settings for SeedStation.

The application is designed for a trusted LAN. It never enables Django debug
mode or exposes qBittorrent's Web API by default.
"""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# WhiteNoise resolves static content types through the stdlib map. Some Linux
# distributions do not know the web app manifest type, which makes browsers
# reject the installed-app metadata.
mimetypes.add_type("application/manifest+json", ".webmanifest")

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

load_dotenv(PROJECT_ROOT / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except (TypeError, ValueError) as exc:
        raise ImproperlyConfigured(f"{name} must be an integer") from exc


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("SEEDSTATION_SECRET_KEY", "")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "SEEDSTATION_SECRET_KEY is not set. Run ./scripts/setup.sh to generate the local .env file."
    )

DEBUG = env_bool("SEEDSTATION_DEBUG", False)

# Host validation is performed by apps.core.middleware.LANHostMiddleware so the
# app keeps working when the laptop's DHCP address changes, while still
# rejecting requests addressed to a public hostname.
ALLOWED_HOSTS = ["*"]

PORT = env_int("SEEDSTATION_PORT", 8000)
TIME_ZONE = os.environ.get("SEEDSTATION_TIME_ZONE", "UTC")
LANGUAGE_CODE = "en-us"
USE_I18N = True
USE_TZ = True

APP_VERSION = "1.0.0"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "channels",
    "apps.accounts",
    "apps.core",
    "apps.torrents",
    "apps.files",
    "apps.dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "apps.core.middleware.LANHostMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "instance" / "seedstation.sqlite3",
        "OPTIONS": {"timeout": 20},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Sessions / CSRF -------------------------------------------------------
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "seedstation_session"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SEEDSTATION_SECURE_COOKIES", False)
CSRF_COOKIE_NAME = "seedstation_csrf"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = env_bool("SEEDSTATION_SECURE_COOKIES", False)
CSRF_TRUSTED_ORIGINS = env_list(
    "SEEDSTATION_CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CSRF_FAILURE_VIEW = "apps.accounts.csrf.csrf_failure"

# --- CORS ------------------------------------------------------------------
# The built frontend is served by Django on the same origin. CORS is only
# needed for the optional Vite development server.
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env_list(
    "SEEDSTATION_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOW_ALL_ORIGINS = False

# --- Storage / uploads -----------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# WhiteNoise serves the built React app's hashed assets directly.
WHITENOISE_ROOT = FRONTEND_DIST
WHITENOISE_AUTOREFRESH = DEBUG
WHITENOISE_MAX_AGE = 0
WHITENOISE_MIMETYPES = {".webmanifest": "application/manifest+json"}

DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
FILE_UPLOAD_PERMISSIONS = 0o640

# --- Django REST Framework -------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "EXCEPTION_HANDLER": "apps.core.errors.api_exception_handler",
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}

# --- Channels --------------------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# --- Security headers ------------------------------------------------------
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
SECURE_HSTS_SECONDS = 0
SECURE_SSL_REDIRECT = False

# --- SeedStation configuration --------------------------------------------
SEEDSTATION_LAN_ONLY = env_bool("SEEDSTATION_LAN_ONLY", True)
SEEDSTATION_TESTING = env_bool("SEEDSTATION_TESTING", False)
SEEDSTATION_EXTRA_ALLOWED_HOSTS = env_list("SEEDSTATION_ALLOWED_HOSTS", "")
SEEDSTATION_DOWNLOAD_DIR = os.environ.get(
    "SEEDSTATION_DOWNLOAD_DIR", str(PROJECT_ROOT / "storage" / "downloads")
)
SEEDSTATION_EXTRA_DIRS = env_list("SEEDSTATION_EXTRA_DIRS", "")

QBIT_HOST = os.environ.get("SEEDSTATION_QBIT_HOST", "127.0.0.1")
QBIT_PORT = env_int("SEEDSTATION_QBIT_PORT", 8081)
QBIT_USERNAME = os.environ.get("SEEDSTATION_QBIT_USERNAME", "")
QBIT_PASSWORD = os.environ.get("SEEDSTATION_QBIT_PASSWORD", "")
QBIT_CONNECT_TIMEOUT = env_int("SEEDSTATION_QBIT_CONNECT_TIMEOUT", 3)
QBIT_READ_TIMEOUT = env_int("SEEDSTATION_QBIT_READ_TIMEOUT", 12)

SEEDSTATION_ADMIN_USERNAME = os.environ.get("SEEDSTATION_ADMIN_USERNAME", "admin")
SEEDSTATION_ADMIN_PASSWORD = os.environ.get("SEEDSTATION_ADMIN_PASSWORD", "")
SEEDSTATION_ADMIN_EMAIL = os.environ.get(
    "SEEDSTATION_ADMIN_EMAIL", "admin@seedstation.local"
)

MAX_TORRENT_FILE_SIZE = 10 * 1024 * 1024
TELEMETRY_RETENTION_DAYS = 30
LOGIN_MAX_ATTEMPTS = 6
LOGIN_LOCKOUT_SECONDS = 15 * 60

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "seedstation",
        "TIMEOUT": 300,
    }
}

LOG_LEVEL = os.environ.get("SEEDSTATION_LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "{asctime} {levelname} {name}: {message}",
            "style": "{",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "qbittorrentapi": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

LANGUAGE_COOKIE_NAME = "seedstation_language"
