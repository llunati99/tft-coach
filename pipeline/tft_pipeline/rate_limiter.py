import time
from collections import deque
from threading import Lock


class SlidingWindowRateLimiter:
    """Blocks callers so at most `limit` calls happen in any `window_seconds`
    span. Riot enforces multiple overlapping windows (e.g. 20/1s and
    100/2min) per key, so use one instance per window and satisfy all of
    them before making a request.
    """

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window_seconds = window_seconds
        self._timestamps: deque[float] = deque()
        self._lock = Lock()

    def acquire(self) -> None:
        while True:
            with self._lock:
                now = time.monotonic()
                while self._timestamps and now - self._timestamps[0] > self.window_seconds:
                    self._timestamps.popleft()

                if len(self._timestamps) < self.limit:
                    self._timestamps.append(now)
                    return

                sleep_for = self.window_seconds - (now - self._timestamps[0])

            time.sleep(max(sleep_for, 0.01))


class CompositeRateLimiter:
    """Satisfies several SlidingWindowRateLimiters before allowing a call."""

    def __init__(self, *limiters: SlidingWindowRateLimiter):
        self.limiters = limiters

    def acquire(self) -> None:
        for limiter in self.limiters:
            limiter.acquire()
