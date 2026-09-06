"""Recomputes comp_stats and item_stats from the raw matches table, one
game_version (patch) at a time.

Usage: python -m tft_pipeline.stats
"""

import logging
from collections import defaultdict

from . import db
from .comp_signature import carry_unit, comp_signature, item_build
from .config import load_settings

logger = logging.getLogger(__name__)

MIN_SAMPLE_SIZE = 5


def _summarize(placements: list[int]) -> dict | None:
    """Returns games_played/avg_placement/top4_rate/win_rate for a list of
    placements (1-8), or None if the sample is too small to be meaningful.
    """
    games_played = len(placements)
    if games_played < MIN_SAMPLE_SIZE:
        return None
    return {
        "games_played": games_played,
        "avg_placement": sum(placements) / games_played,
        "top4_rate": sum(1 for p in placements if p <= 4) / games_played,
        "win_rate": sum(1 for p in placements if p == 1) / games_played,
    }


def compute_stats_for_version(matches: list[dict]) -> tuple[list[dict], list[dict]]:
    comp_placements: dict[str, list[int]] = defaultdict(list)
    item_placements: dict[tuple[str, str, str], list[int]] = defaultdict(list)

    for match in matches:
        for participant in match["info"].get("participants", []):
            placement = participant.get("placement")
            if placement is None:
                continue

            signature = comp_signature(participant)
            comp_placements[signature].append(placement)

            carry = carry_unit(participant)
            build = item_build(participant, carry)
            if build:
                item_placements[(signature, carry, build)].append(placement)

    comp_rows = []
    for signature, placements in comp_placements.items():
        summary = _summarize(placements)
        if summary:
            comp_rows.append({"comp_signature": signature, **summary})

    item_rows = []
    for (signature, carry, build), placements in item_placements.items():
        summary = _summarize(placements)
        if summary:
            item_rows.append(
                {
                    "comp_signature": signature,
                    "carry_unit": carry,
                    "item_build": build,
                    **summary,
                }
            )

    return comp_rows, item_rows


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = load_settings()

    with db.connect(settings) as conn:
        db.apply_schema(conn)

        for game_version in db.distinct_game_versions(conn):
            matches = db.fetch_matches_for_version(conn, game_version)
            comp_rows, item_rows = compute_stats_for_version(matches)

            db.upsert_comp_stats(conn, game_version, comp_rows)
            db.upsert_item_stats(conn, game_version, item_rows)

            logger.info(
                "Patch %s: %d matches -> %d comp signatures, %d item builds",
                game_version,
                len(matches),
                len(comp_rows),
                len(item_rows),
            )


if __name__ == "__main__":
    main()
