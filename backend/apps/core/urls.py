from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("settings/", views.SettingsView.as_view(), name="settings"),
    path("system/", views.SystemView.as_view(), name="system"),
]
