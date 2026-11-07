from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("session/", views.session_view, name="session"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("me/", views.me_view, name="me"),
    path("password/", views.password_change_view, name="password"),
]
