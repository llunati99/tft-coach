from contextlib import contextmanager
from importlib import resources
from typing import Iterator

import psycopg
from psycopg import Connection
from psycopg.types.json import Jsonb

from .config import Settings


def connect_raw(settings: Settings) -> Connection:
    """A plain (non-context-manager) connection — for callers that need to
    replace a dropped connection mid-run (see collect.py's reconnect loop)
    rather than hold one open for the whole process lifetime."""
    return psycopg.connect(settings.database_url)


@contextmanager
def connect(settings: Settings) -> Iterator[Connection]:
    conn = connect_raw(settings)
    try:
        yield conn
    finally:
        conn.close()


def apply_schema(conn: Connection) -> None:
    schema_sql = resources.files("tft_pipeline").joinpath("schema.sql").read_text()
    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()


def match_exists(conn: Connection, match_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM matches WHERE match_id = %s", (match_id,))
        return cur.fetchone() is not None


def insert_match(
    conn: Connection,
    match_id: str,
    region: str,
    game_version: str,
    game_datetime: int,
    raw_data: dict,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO matches (match_id, region, game_version, game_datetime, raw_data)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (match_id) DO NOTHING
            """,
            (match_id, region, game_version, game_datetime, Jsonb(raw_data)),
        )
    conn.commit()


def is_player_crawled(conn: Connection, puuid: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM crawled_players WHERE puuid = %s", (puuid,))
        return cur.fetchone() is not None


def mark_player_crawled(conn: Connection, puuid: str, region: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO crawled_players (puuid, region, last_crawled_at)
            VALUES (%s, %s, now())
            ON CONFLICT (puuid) DO UPDATE SET last_crawled_at = now()
            """,
            (puuid, region),
        )
    conn.commit()


def fetch_matches_for_version(conn: Connection, game_version: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT raw_data FROM matches WHERE game_version = %s", (game_version,)
        )
        return [row[0] for row in cur.fetchall()]


def distinct_game_versions(conn: Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT game_version FROM matches")
        return [row[0] for row in cur.fetchall()]


def upsert_comp_stats(conn: Connection, game_version: str, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM comp_stats WHERE game_version = %s", (game_version,))
        cur.executemany(
            """
            INSERT INTO comp_stats
                (game_version, comp_signature, games_played, avg_placement, top4_rate, win_rate)
            VALUES (%(game_version)s, %(comp_signature)s, %(games_played)s,
                    %(avg_placement)s, %(top4_rate)s, %(win_rate)s)
            """,
            [{**row, "game_version": game_version} for row in rows],
        )
    conn.commit()


def upsert_item_stats(conn: Connection, game_version: str, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM item_stats WHERE game_version = %s", (game_version,))
        cur.executemany(
            """
            INSERT INTO item_stats
                (game_version, comp_signature, carry_unit, item_build,
                 games_played, avg_placement, top4_rate, win_rate)
            VALUES (%(game_version)s, %(comp_signature)s, %(carry_unit)s, %(item_build)s,
                    %(games_played)s, %(avg_placement)s, %(top4_rate)s, %(win_rate)s)
            """,
            [{**row, "game_version": game_version} for row in rows],
        )
    conn.commit()
