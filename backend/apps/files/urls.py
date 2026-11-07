from django.urls import path

from . import views

urlpatterns = [
    path("", views.FileListView.as_view(), name="file-list"),
    path("roots/", views.RootsView.as_view(), name="file-roots"),
    path("download/", views.DownloadView.as_view(), name="file-download"),
    path("archive/", views.ArchiveView.as_view(), name="file-archive"),
    path("text/", views.TextView.as_view(), name="file-text"),
    path("delete/", views.DeleteView.as_view(), name="file-delete"),
]
