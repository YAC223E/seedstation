"""Settings used by the automated test suite only."""

from .settings import *  # noqa: F401,F403

SEEDSTATION_TESTING = True
DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "seedstation-tests",
    }
}
# Keep CSRF and session behavior realistic, but require no HTTPS for tests.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
