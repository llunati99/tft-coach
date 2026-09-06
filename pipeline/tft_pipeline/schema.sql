-- Raw matches, stored once and reused to recompute stats without re-fetching
-- from Riot. `game_version` is the authoritative patch tag Riot embeds in
-- each match (e.g. "Version 14.18.593.1234") and is what stats are grouped
-- by, rather than an externally inferred "current patch".
CREATE TABLE IF NOT EXISTS matches (
    match_id TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    game_version TEXT NOT NULL,
    game_datetime BIGINT NOT NULL,
    raw_data JSONB NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_game_version ON matches (game_version);

-- Players already ingested or queued, so the snowball crawl doesn't refetch
-- the same puuid's match history repeatedly.
CREATE TABLE IF NOT EXISTS crawled_players (
    puuid TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    last_crawled_at TIMESTAMPTZ
);

-- Aggregated stats for a "comp signature" (core traits + carry unit) on a
-- given patch. Recomputed by stats.py from the matches table.
CREATE TABLE IF NOT EXISTS comp_stats (
    game_version TEXT NOT NULL,
    comp_signature TEXT NOT NULL,
    games_played INTEGER NOT NULL,
    avg_placement DOUBLE PRECISION NOT NULL,
    top4_rate DOUBLE PRECISION NOT NULL,
    win_rate DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_version, comp_signature)
);

-- Aggregated stats for an item build on a given carry unit, within a comp
-- signature, on a given patch.
CREATE TABLE IF NOT EXISTS item_stats (
    game_version TEXT NOT NULL,
    comp_signature TEXT NOT NULL,
    carry_unit TEXT NOT NULL,
    item_build TEXT NOT NULL,
    games_played INTEGER NOT NULL,
    avg_placement DOUBLE PRECISION NOT NULL,
    top4_rate DOUBLE PRECISION NOT NULL,
    win_rate DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_version, comp_signature, carry_unit, item_build)
);
