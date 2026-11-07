from django.http import JsonResponse
from django.views.decorators.cache import never_cache


@never_cache
def csrf_failure(request, reason=""):
    """Return JSON when a state-changing API call lacks a valid CSRF token."""
    return JsonResponse(
        {
            "detail": "Your security token expired. Refresh the page and try again.",
            "code": "csrf_failed",
        },
        status=403,
    )
