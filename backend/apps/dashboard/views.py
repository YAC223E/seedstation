from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.torrents.live import collect_live_snapshot, history


class SummaryView(APIView):
    def get(self, request):
        snapshot = collect_live_snapshot(record=True)
        response = Response(
            {
                "timestamp": snapshot["timestamp"],
                "engine": snapshot["engine"],
                "transfer": snapshot["transfer"],
                "summary": snapshot["summary"],
                "storage": snapshot["storage"],
                "recent": snapshot["recent"],
                "server": snapshot["server"],
            }
        )
        response["Cache-Control"] = "no-store"
        return response


class HistoryView(APIView):
    def get(self, request):
        try:
            hours = int(request.query_params.get("hours", 6))
        except (TypeError, ValueError):
            return Response(
                {"detail": "hours must be a number between 1 and 168.", "code": "invalid_range"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hours < 1 or hours > 24 * 7:
            return Response(
                {"detail": "hours must be between 1 and 168.", "code": "invalid_range"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = Response(history(hours=hours))
        response["Cache-Control"] = "no-store"
        return response
