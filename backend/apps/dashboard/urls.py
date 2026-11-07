from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.SummaryView.as_view(), name="dashboard-summary"),
    path("history/", views.HistoryView.as_view(), name="dashboard-history"),
]
