from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from themoviedb import aioTMDb, PartialMedia, PartialMovie, PartialTV, Person

@dataclass(slots=True)
class _QueuedCall[T]:
    factory: Callable[[], Awaitable[T]]
    future: asyncio.Future[T]


class TMDBClient:
    def __init__(
        self,
        *,
        key: str,
        language: str,
        region: str,
        max_workers: int = 1,
        max_retries: int = 5,
        base_backoff: float = 1.0,
        backoff_multiplier: float = 2.0,
        max_backoff: float = 30.0,
        jitter: float = 0.5,
    ) -> None:
        self._tmdb = aioTMDb(key=key, language=language, region=region)
        self._queue: asyncio.Queue[_QueuedCall[Any]] = asyncio.Queue()
        self._max_workers = max(1, max_workers)
        self._max_retries = max(0, max_retries)
        self._base_backoff = max(0.0, base_backoff)
        self._backoff_multiplier = max(1.0, backoff_multiplier)
        self._max_backoff = max(self._base_backoff, max_backoff)
        self._jitter = max(0.0, jitter)
        self._workers_started = False
        self._workers: list[asyncio.Task[None]] = []

    async def _ensure_workers(self) -> None:
        if self._workers_started:
            return
        self._workers_started = True
        for _ in range(self._max_workers):
            self._workers.append(asyncio.create_task(self._worker()))

    async def _worker(self) -> None:
        while True:
            queued_call = await self._queue.get()
            try:
                await self._execute(queued_call)
            finally:
                self._queue.task_done()

    async def _execute(self, queued_call: _QueuedCall[Any]) -> None:
        if queued_call.future.cancelled():
            return

        attempt = 0
        while True:
            try:
                result = await queued_call.factory()
            except asyncio.CancelledError:
                if not queued_call.future.cancelled():
                    queued_call.future.cancel()
                raise
            except Exception as exc:  # noqa: BLE001
                if self._is_rate_limited(exc) and attempt < self._max_retries:
                    await asyncio.sleep(self._compute_delay(attempt, exc))
                    attempt += 1
                    continue
                if not queued_call.future.done():
                    queued_call.future.set_exception(exc)
                break
            else:
                if not queued_call.future.done():
                    queued_call.future.set_result(result)
                break

    async def _submit[T](self, factory: Callable[[], Awaitable[T]]) -> T:
        await self._ensure_workers()
        loop = asyncio.get_running_loop()
        future: asyncio.Future[T] = loop.create_future()
        await self._queue.put(_QueuedCall(factory=factory, future=future))
        return await future

    def search(self) -> _SearchProxy:
        return _SearchProxy(self)

    def person(self, person_id: int) -> _PersonProxy:
        return _PersonProxy(self, person_id)

    @staticmethod
    def _status_code(exc: Exception) -> int | None:
        response = getattr(exc, "response", None)
        status_code = getattr(response, "status_code", None)
        return status_code if isinstance(status_code, int) else None

    def _is_rate_limited(self, exc: Exception) -> bool:
        return self._status_code(exc) == 429

    def _compute_delay(self, attempt: int, exc: Exception) -> float:
        delay = min(
            self._base_backoff * (self._backoff_multiplier**attempt),
            self._max_backoff,
        )
        response = getattr(exc, "response", None)
        headers = getattr(response, "headers", None)
        retry_after: Any = None
        if headers is not None:
            getter = getattr(headers, "get", None)
            if callable(getter):
                retry_after = getter("Retry-After")
        if retry_after is not None:
            try:
                header_delay = float(retry_after)
            except (TypeError, ValueError):
                header_delay = None
            if header_delay is not None:
                delay = max(delay, header_delay)
        if self._jitter > 0:
            delay += random.uniform(0, self._jitter)
        return delay


class _SearchProxy:
    def __init__(self, client: TMDBClient) -> None:
        self._client = client

    async def movies(self, *, query: str, page: int = 1):
        return await self._client._submit(  # noqa: SLF001
            lambda: self._client._tmdb.search().movies(query=query, page=page)  # noqa: SLF001
        )

    async def tv(self, *, query: str, page: int = 1):
        return await self._client._submit(  # noqa: SLF001
            lambda: self._client._tmdb.search().tv(query=query, page=page)  # noqa: SLF001
        )

    async def people(self, *, query: str, page: int = 1):
        return await self._client._submit(  # noqa: SLF001
            lambda: self._client._tmdb.search().people(query=query, page=page)  # noqa: SLF001
        )


class _PersonProxy:
    def __init__(self, client: TMDBClient, person_id: int) -> None:
        self._client = client
        self._person_id = person_id

    async def combined_credits(self):
        return await self._client._submit(  # noqa: SLF001
            lambda: self._client._tmdb.person(self._person_id).combined_credits()  # noqa: SLF001
        )


tmdb = TMDBClient(
    key="664bdab2fb8644acc4be2cff2bb52414",
    language="fr-FR",
    region="FR",
    max_workers=2,
)

__all__ = [
    "tmdb",
    "TMDBClient",
    "PartialMovie",
    "PartialTV",
    "Person",
    "PartialMedia",
]
