from django.contrib import admin
from django.urls import include, path, re_path

from apps.core.views import spa_index, static_not_found

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.torrents.urls")),
    path("api/files/", include("apps.files.urls")),
    path("api/dashboard/", include("apps.dashboard.urls")),
    # Missing build assets must be a real 404. WhiteNoise handles existing
    # files first; these patterns only catch the leftovers.
    re_path(r"^(?:assets|static)/", static_not_found),
    re_path(r"^[^/]+\.[A-Za-z0-9]{1,12}$", static_not_found),
    # SPA routes (no dots) fall back to the Vite build. Hashed assets and
    # missing files are left alone so a missing image returns a real 404.
    re_path(r"^(?!api/|ws/|admin/|static/)(?!.*\.[^/]+$).*$", spa_index, name="spa"),
]
