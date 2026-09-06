import logging
import time

import httpx

from .config import Settings
from .rate_limiter import CompositeRateLimiter, SlidingWindowRateLimiter

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_RETRIES = 5


class RiotClient:
    """Thin wrapper over the Riot TFT REST endpoints used for data
    collection: high-elo league listings, match id lookups, and match
    details. Handles regional routing and rate limiting; does not attempt to
    cover the full Riot API surface.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self._http = httpx.Client(
            headers={"X-Riot-Token": settings.riot_api_key}, timeout=10.0
        )
        self._limiter = CompositeRateLimiter(
            SlidingWindowRateLimiter(settings.rate_limit_per_second, 1.0),
            SlidingWindowRateLimiter(settings.rate_limit_per_two_minutes, 120.0),
        )

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "RiotClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()

    def _get(self, url: str) -> dict:
        for attempt in range(1, MAX_RETRIES + 1):
            self._limiter.acquire()
            response = self._http.get(url)

            if response.status_code == 200:
                return response.json()

            if response.status_code in RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES:
                retry_after = float(response.headers.get("Retry-After", 1))
                logger.warning(
                    "Riot API %s on %s, retrying in %.1fs (attempt %d/%d)",
                    response.status_code,
                    url,
                    retry_after,
                    attempt,
                    MAX_RETRIES,
                )
                time.sleep(retry_after)
                continue

            response.raise_for_status()

        raise RuntimeError(f"Exhausted retries calling {url}")

    # -- Platform-routed endpoints (league/summoner) --------------------

    def get_challenger_league(self) -> dict:
        url = (
            f"https://{self.settings.platform}.api.riotgames.com"
            "/tft/league/v1/challenger"
        )
        return self._get(url)

    def get_grandmaster_league(self) -> dict:
        url = (
            f"https://{self.settings.platform}.api.riotgames.com"
            "/tft/league/v1/grandmaster"
        )
        return self._get(url)

    def get_master_league(self) -> dict:
        url = (
            f"https://{self.settings.platform}.api.riotgames.com"
            "/tft/league/v1/master"
        )
        return self._get(url)

    # -- Region-routed endpoints (match) ---------------------------------

    def get_match_ids_by_puuid(self, puuid: str, count: int = 20) -> list[str]:
        url = (
            f"https://{self.settings.region}.api.riotgames.com"
            f"/tft/match/v1/matches/by-puuid/{puuid}/ids?count={count}"
        )
        return self._get(url)

    def get_match(self, match_id: str) -> dict:
        url = (
            f"https://{self.settings.region}.api.riotgames.com"
            f"/tft/match/v1/matches/{match_id}"
        )
        return self._get(url)
