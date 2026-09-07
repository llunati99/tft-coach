/**
 * Read-only Postgres access against the same Neon database
 * pipeline/tft_pipeline/db.py writes to (schema: pipeline/tft_pipeline/schema.sql).
 * This app never writes to comp_stats/item_stats — only the Python pipeline does.
 */
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — copy web/.env.local.example to web/.env.local");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export interface CompStatsRow {
  gameVersion: string;
  compSignature: string;
  gamesPlayed: number;
  avgPlacement: number;
  top4Rate: number;
  winRate: number;
}

export interface ItemStatsRow {
  gameVersion: string;
  compSignature: string;
  carryUnit: string;
  itemBuild: string;
  gamesPlayed: number;
  avgPlacement: number;
  top4Rate: number;
  winRate: number;
}

/**
 * The patch stats should be read from: the game_version of the most
 * recently PLAYED match we've stored (by game_datetime).
 *
 * Previously this took whichever game_version comp_stats was most
 * recently recomputed for — but stats.py loops over
 * `SELECT DISTINCT game_version FROM matches` with no defined order, so
 * "most recently updated_at" was really just whichever patch happened to
 * be processed last, not the true current patch. Verified live: once the
 * matches table grew to span many real patches (Set 18 alone had matches
 * from Dec 2025 through Aug 2026), that arbitrary ordering would have
 * picked a random old patch's stats instead of the current one.
 */
export async function getCurrentGameVersion(): Promise<string | null> {
  const result = await getPool().query<{ game_version: string }>(
    "SELECT game_version FROM matches ORDER BY game_datetime DESC LIMIT 1"
  );
  return result.rows[0]?.game_version ?? null;
}

export async function getCompStats(compSignature: string): Promise<CompStatsRow | null> {
  const gameVersion = await getCurrentGameVersion();
  if (!gameVersion) return null;

  const result = await getPool().query(
    `SELECT game_version, comp_signature, games_played, avg_placement, top4_rate, win_rate
     FROM comp_stats
     WHERE game_version = $1 AND comp_signature = $2`,
    [gameVersion, compSignature]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    gameVersion: row.game_version,
    compSignature: row.comp_signature,
    gamesPlayed: row.games_played,
    avgPlacement: Number(row.avg_placement),
    top4Rate: Number(row.top4_rate),
    winRate: Number(row.win_rate),
  };
}

export async function getItemStats(
  compSignature: string,
  carryUnit: string,
  limit = 5
): Promise<ItemStatsRow[]> {
  const gameVersion = await getCurrentGameVersion();
  if (!gameVersion) return [];

  const result = await getPool().query(
    `SELECT game_version, comp_signature, carry_unit, item_build,
            games_played, avg_placement, top4_rate, win_rate
     FROM item_stats
     WHERE game_version = $1 AND comp_signature = $2 AND carry_unit = $3
     ORDER BY games_played DESC
     LIMIT $4`,
    [gameVersion, compSignature, carryUnit, limit]
  );

  return result.rows.map((row) => ({
    gameVersion: row.game_version,
    compSignature: row.comp_signature,
    carryUnit: row.carry_unit,
    itemBuild: row.item_build,
    gamesPlayed: row.games_played,
    avgPlacement: Number(row.avg_placement),
    top4Rate: Number(row.top4_rate),
    winRate: Number(row.win_rate),
  }));
}
