"""Seeds match collection from high-elo players and snowballs outward to
other participants, storing raw match JSON so stats can be recomputed later
without re-fetching from Riot.

Usage: python -m tft_pipeline.collect [--max-players N] [--matches-per-player N]
"""

import argparse
import logging

import psycopg

from . import db
from .config import load_settings
from .riot_client import RiotClient

logger = logging.getLogger(__name__)


def seed_puuids(client: RiotClient, max_players: int) -> list[str]:
    puuids: list[str] = []
    for fetch in (
        client.get_challenger_league,
        client.get_grandmaster_league,
        client.get_master_league,
    ):
        league = fetch()
        puuids.extend(entry["puuid"] for entry in league.get("entries", []))
        if len(puuids) >= max_players:
            break
    return puuids[:max_players]


def collect(max_players: int, matches_per_player: int) -> None:
    settings = load_settings()

    with RiotClient(settings) as client:
        conn = db.connect_raw(settings)
        db.apply_schema(conn)

        queue = seed_puuids(client, max_players)
        seen = set(queue)
        players_crawled = 0

        while queue and players_crawled < max_players:
            puuid = queue.pop(0)

            try:
                if db.is_player_crawled(conn, puuid):
                    continue

                try:
                    match_ids = client.get_match_ids_by_puuid(puuid, count=matches_per_player)
                except Exception:
                    logger.exception("Failed to fetch match ids for puuid %s", puuid)
                    continue

                for match_id in match_ids:
                    if db.match_exists(conn, match_id):
                        continue

                    try:
                        match = client.get_match(match_id)
                    except Exception:
                        logger.exception("Failed to fetch match %s", match_id)
                        continue

                    info = match["info"]
                    db.insert_match(
                        conn,
                        match_id=match_id,
                        region=settings.region,
                        game_version=info["game_version"],
                        game_datetime=info["game_datetime"],
                        raw_data=match,
                    )

                    for participant in info.get("participants", []):
                        other_puuid = participant.get("puuid")
                        if other_puuid and other_puuid not in seen:
                            seen.add(other_puuid)
                            queue.append(other_puuid)

                db.mark_player_crawled(conn, puuid, settings.region)
                players_crawled += 1
                logger.info(
                    "Crawled %d/%d players (queue size: %d)",
                    players_crawled,
                    max_players,
                    len(queue),
                )
            except psycopg.OperationalError:
                logger.warning(
                    "DB connection dropped mid-player (%s) — reconnecting and retrying.", puuid
                )
                try:
                    conn.close()
                except Exception:
                    pass
                conn = db.connect_raw(settings)
                queue.insert(0, puuid)
                continue

        conn.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-players", type=int, default=50)
    parser.add_argument("--matches-per-player", type=int, default=20)
    args = parser.parse_args()

    collect(max_players=args.max_players, matches_per_player=args.matches_per_player)


if __name__ == "__main__":
    main()
