from django.urls import path

from . import views

urlpatterns = [
    path("live/", views.LiveView.as_view(), name="live"),
    path("torrents/", views.TorrentListView.as_view(), name="torrent-list"),
    path("torrents/add-magnet/", views.MagnetAddView.as_view(), name="torrent-add-magnet"),
    path("torrents/upload/", views.TorrentUploadView.as_view(), name="torrent-upload"),
    path("torrents/<str:torrent_hash>/", views.TorrentDetailView.as_view(), name="torrent-detail"),
    path("torrents/<str:torrent_hash>/pause/", views.TorrentPauseView.as_view(), name="torrent-pause"),
    path("torrents/<str:torrent_hash>/resume/", views.TorrentResumeView.as_view(), name="torrent-resume"),
    path("torrents/<str:torrent_hash>/recheck/", views.TorrentRecheckView.as_view(), name="torrent-recheck"),
]
