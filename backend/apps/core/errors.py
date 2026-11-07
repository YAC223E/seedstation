"""Normalized DRF error payloads for the React client."""

from __future__ import annotations

from typing import Any

from rest_framework.views import exception_handler


def _first_message(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        for item in value:
            message = _first_message(item)
            if message:
                return message
    if isinstance(value, dict):
        for key, item in value.items():
            message = _first_message(item)
            if message:
                if key in {"detail", "non_field_errors"}:
                    return message
                return f"{key}: {message}"
    return "The request could not be completed."


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    original = response.data
    message = _first_message(original)
    code = getattr(exc, "default_code", "error")
    response.data = {
        "detail": message,
        "code": code,
        "errors": original if isinstance(original, (dict, list)) else None,
    }
    return response
