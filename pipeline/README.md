# tft-coach data pipeline

Collects real TFT match data from the official Riot API and computes real
placement/win-rate statistics per comp signature and item build, per patch.
No UI here — this is the statistical foundation the future web app will
recommend from.

## Setup

1. Get a Riot developer API key at https://developer.riotgames.com/ (a free
   dev key works to start, but expires every 24h and has a low rate limit —
   fine for testing, not for large-scale collection).
2. Get a Postgres database connection string — a free instance on
   [Supabase](https://supabase.com) or [Neon](https://neon.tech) works well.
3. Copy `.env.example` to `.env` in this folder and fill in `RIOT_API_KEY`
   and `DATABASE_URL`.
4. Install dependencies:
   ```
   pip install -e .
   ```

## Running it

Collect matches (seeds from Challenger/Grandmaster/Master players on your
configured platform, then snowballs to other participants):

```
python -m tft_pipeline.collect --max-players 50 --matches-per-player 20
```

Recompute statistics from everything collected so far:

```
python -m tft_pipeline.stats
```

Both are safe to re-run — `collect` skips matches/players already stored,
and `stats` recomputes each patch's numbers from scratch from stored raw
matches.

## How stats are grouped

Exact unit-by-unit compositions vary too much to group literally, so matches
are bucketed by a **comp signature**: a participant's top 2 active traits
plus their most-invested ("carry") unit — see `comp_signature.py`. Item
stats are further split by the exact item build on that carry. Signatures
with fewer than 5 sample games are dropped as not statistically meaningful
(`MIN_SAMPLE_SIZE` in `stats.py`).

Everything is grouped by `game_version`, the patch string Riot embeds in
each match — recommendations should only ever read the current patch's row.
