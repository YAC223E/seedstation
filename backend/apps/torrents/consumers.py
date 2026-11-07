from __future__ import annotations

import asyncio
import logging
from contextlib import suppress

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from apps.core.middleware import origin_is_allowed

from .live import collect_live_snapshot

logger = logging.getLogger(__name__)


class LiveConsumer(AsyncJsonWebsocketConsumer):
    task: asyncio.Task | None = None

    async def connect(self):
        user = self.scope.get("user")
        headers = dict(self.scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode("latin-1")
        host = headers.get(b"host", b"").decode("latin-1")
        if origin and not origin_is_allowed(origin, host):
            logger.warning("Rejected WebSocket origin: %s", origin)
            await self.close(code=4403)
            return
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        await self.accept()
        self.task = asyncio.create_task(self._stream())

    async def disconnect(self, code):
        if self.task:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
            self.task = None

    async def _stream(self):
        try:
            while True:
                try:
                    snapshot = await database_sync_to_async(collect_live_snapshot, thread_sensitive=True)(
                        record=True
                    )
                    await self.send_json(
                        {
                            "type": "snapshot",
                            "serverTime": timezone.now().isoformat(),
                            "data": snapshot,
                        }
                    )
                    delay = 2.0 if snapshot["engine"]["online"] else 5.0
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # keep the socket alive through transient errors
                    logger.exception("Live update failed: %s", exc)
                    await self.send_json(
                        {
                            "type": "error",
                            "detail": "Live update unavailable.",
                            "code": "live_update_failed",
                        }
                    )
                    delay = 5.0
                await asyncio.sleep(delay)
        except asyncio.CancelledError:
            raise
