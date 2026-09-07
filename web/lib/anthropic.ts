import Anthropic from "@anthropic-ai/sdk";
import type { TftGameData } from "./staticData";
import { formatGameDataForPrompt } from "./staticData";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set — copy web/.env.local.example to web/.env.local"
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface BoardUnitReading {
  apiName: string;
  star: number;
  items: string[];
}

export interface BoardReading {
  units: BoardUnitReading[];
  bench: BoardUnitReading[];
  shop: string[];
  looseItems: string[];
  gold: number;
  level: number;
  stage: string;
  augments: string[];
  rerollCost: number | null;
}

/**
 * Champion/item apiNames use inconsistent internal naming across the set
 * (e.g. "DA_Riftbeast18" vs "DA_18_Elderwood" — no fixed pattern), so a
 * model asked to freely type one occasionally hallucinates a
 * plausible-looking but wrong string (seen live: real champion apiNames
 * came back correct in `shop` but a fabricated one in `units` for the same
 * champion in the same response). Constraining apiName fields to an enum
 * of the real current-set names makes the model pick from the real list
 * instead of inventing one.
 */
function buildBoardTool(gameData: TftGameData) {
  const championApiNames = gameData.champions.map((c) => c.apiName);
  const itemApiNames = gameData.items.map((i) => i.apiName);

  const unitSchema = {
    type: "object" as const,
    properties: {
      apiName: { type: "string", enum: championApiNames, description: "Champion apiName." },
      star: { type: "integer", description: "Star level: 1, 2, or 3." },
      items: {
        type: "array",
        items: { type: "string", enum: itemApiNames },
        description: "Item apiNames equipped. Empty if none.",
      },
    },
    required: ["apiName", "star", "items"],
  };

  return {
    name: "report_board",
    description: "Report the Teamfight Tactics board state read from the screenshot.",
    input_schema: {
      type: "object" as const,
      properties: {
        units: { type: "array", description: "Champions currently placed on the board (not the bench).", items: unitSchema },
        bench: { type: "array", description: "Champions on the bench (not placed on board).", items: unitSchema },
        shop: {
          type: "array",
          items: { type: "string", enum: championApiNames },
          description:
            "Champion apiNames currently offered in the shop row at the bottom of the screen, " +
            "left to right. Omit a slot if it's empty/already bought/not visible.",
        },
        looseItems: {
          type: "array",
          items: { type: "string", enum: itemApiNames },
          description:
            "Item apiNames sitting unequipped in the player's item bag/tray (a row of item icons " +
            "usually shown above or near the bench, separate from items already equipped on a " +
            "unit). Empty if the tray is empty or not visible.",
        },
        gold: { type: "integer", description: "Current gold available." },
        level: { type: "integer", description: "Current board level." },
        stage: { type: "string", description: "Current stage-round, e.g. '3-2'." },
        augments: {
          type: "array",
          items: { type: "string" },
          description: "Augment names visible/known to be active, if any. Empty if not visible.",
        },
        rerollCost: {
          type: ["integer", "null"],
          description:
            "The gold cost of the next shop reroll, shown next to the coin icon under the " +
            "'Rerrolear'/reroll button at the bottom-left. Normally 2, but can be 0 (free reroll) " +
            "from certain effects — this is worth flagging to the player. Null if not visible.",
        },
      },
      required: ["units", "bench", "shop", "looseItems", "gold", "level", "stage", "augments", "rerollCost"],
    },
  };
}

export async function analyzeScreenshot(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp",
  gameData: TftGameData
): Promise<BoardReading> {
  const boardTool = buildBoardTool(gameData);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "You read Teamfight Tactics screenshots and report the exact board state using the " +
      "report_board tool, including: the shop row at the bottom (champions currently offered for " +
      "purchase), the reroll cost next to the coin icon under the reroll button, and any unequipped " +
      "items sitting in the item bag/tray (separate from items already on a unit) — these are all " +
      "critical, players check this screen mainly to decide what to buy, reroll, or build.\n\n" +
      "MOST screenshots are taken mid-combat, where the player's units and the opponent's are " +
      "mixed together on the same hex arena. Before listing 'units', go through this checklist for " +
      "EVERY character model you can see fighting on the arena:\n" +
      "1. Find its health bar (a thin bar directly above the model).\n" +
      "2. Green or blue bar → it belongs to the player. Report it.\n" +
      "3. Red bar → it belongs to the opponent. Do NOT report it, even if it looks like a strong or " +
      "central unit.\n" +
      "4. As a secondary check, the player's units are usually the ones closer to the bottom/front " +
      "of the screen (nearest the camera); the opponent's are usually further back/top. If this " +
      "conflicts with the health bar color, TRUST THE COLOR.\n" +
      "Do this per-unit check carefully — do not guess based on which units look more central or " +
      "important, and do not report a unit you are not reasonably confident is the player's own " +
      "(green/blue bar). It is better to report fewer units correctly than to guess extra ones.\n\n" +
      "apiName fields are constrained to the real current-set list — always pick the exact matching " +
      "entry, never invent or modify one. If something isn't visible, use your best reading rather " +
      "than guessing wildly, but do not fabricate units/items that aren't there.\n\n" +
      "Reference data for the current set:\n" +
      formatGameDataForPrompt(gameData),
    tools: [boardTool],
    tool_choice: { type: "tool", name: "report_board" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Read this Teamfight Tactics board and report its state." },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a report_board tool call");
  }
  return normalizeBoardReading(toolUse.input as Partial<BoardReading>);
}

/**
 * The Anthropic API doesn't strictly guarantee every field marked
 * `required` in a tool's input_schema actually shows up in the model's
 * output (seen live: `buyFromShop` came back missing, crashing the UI on
 * `.length`) — so every array/nullable field gets a safe default here,
 * once, instead of every caller needing its own defensive checks.
 */
function normalizeUnit(unit: Partial<BoardUnitReading>): BoardUnitReading {
  return {
    apiName: unit.apiName ?? "",
    star: unit.star ?? 1,
    items: unit.items ?? [],
  };
}

function normalizeBoardReading(input: Partial<BoardReading>): BoardReading {
  return {
    units: (input.units ?? []).map(normalizeUnit),
    bench: (input.bench ?? []).map(normalizeUnit),
    shop: input.shop ?? [],
    looseItems: input.looseItems ?? [],
    gold: input.gold ?? 0,
    level: input.level ?? 0,
    stage: input.stage ?? "",
    augments: input.augments ?? [],
    rerollCost: input.rerollCost ?? null,
  };
}

export interface StatsContext {
  source: "real" | "none";
  compSignature: string;
  gamesPlayed?: number;
  avgPlacement?: number;
  top4Rate?: number;
  winRate?: number;
  itemBuilds?: Array<{
    itemBuild: string;
    gamesPlayed: number;
    avgPlacement: number;
    top4Rate: number;
    winRate: number;
  }>;
}

export interface BenchAdvice {
  unit: string;
  action: "vender" | "mantener" | "tablero";
  reason: string;
}

export interface Recommendation {
  shortAdvice: string;
  buyFromShop: string[];
  compDirection: string;
  statsSource: "real" | "estimated";
  sampleSize: number | null;
  priorityChampions: string[];
  itemSuggestions: Array<{ unit: string; item: string; reason: string }>;
  benchAdvice: BenchAdvice[];
  pickupAdvice: string | null;
}

function buildRecommendationTool(gameData: TftGameData) {
  const championApiNames = gameData.champions.map((c) => c.apiName);
  const itemApiNames = gameData.items.map((i) => i.apiName);

  return {
    name: "report_recommendation",
    description: "Report a short, direct TFT recommendation for the current board.",
    input_schema: {
      type: "object" as const,
      properties: {
        shortAdvice: {
          type: "string",
          description:
            "THE main takeaway, in Spanish, one short sentence (max ~15 words). This is the only " +
            "free-text field shown prominently — be direct and specific, not a general explanation.",
        },
        buyFromShop: {
          type: "array",
          items: { type: "string", enum: championApiNames },
          description: "Champion apiNames from the current shop worth buying right now. Empty if none/save gold.",
        },
        compDirection: {
          type: "string",
          description: "Very short label for the comp direction, in Spanish, max 6 words (e.g. 'Riftbeast/Blossom flexible').",
        },
        statsSource: {
          type: "string",
          enum: ["real", "estimated"],
          description: "'real' only if real placement/winrate stats were provided in the prompt; otherwise 'estimated'.",
        },
        sampleSize: {
          type: ["integer", "null"],
          description: "Number of real games backing this, or null if estimated.",
        },
        priorityChampions: {
          type: "array",
          items: { type: "string", enum: championApiNames },
          description: "Champion apiNames worth prioritizing buying/leveling for next (beyond the current shop). Empty if too early to tell.",
        },
        itemSuggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              unit: { type: "string", enum: championApiNames, description: "Champion apiName to receive the item." },
              item: { type: "string", enum: itemApiNames, description: "Item apiName to build." },
              reason: { type: "string", description: "Max one short sentence." },
            },
            required: ["unit", "item", "reason"],
          },
          description: "Empty if there are no units with items to build yet (e.g. very early game).",
        },
        benchAdvice: {
          type: "array",
          items: {
            type: "object",
            properties: {
              unit: { type: "string", enum: championApiNames, description: "Bench champion apiName (real champions only, not pickups)." },
              action: { type: "string", enum: ["vender", "mantener", "tablero"], description: "vender=sell for gold, mantener=keep on bench for now, tablero=field it now." },
              reason: { type: "string", description: "Max one short sentence." },
            },
            required: ["unit", "action", "reason"],
          },
          description: "One entry per REAL champion on the bench (skip pickups like anvils — those go in pickupAdvice). Empty if bench is empty.",
        },
        pickupAdvice: {
          type: ["string", "null"],
          description:
            "One short sentence on what to do with any anvil/tome/chest pickup on the bench (e.g. " +
            "which item/trait to pick, or to save it for later). Null if no pickup is held.",
        },
      },
      required: [
        "shortAdvice",
        "buyFromShop",
        "compDirection",
        "statsSource",
        "sampleSize",
        "priorityChampions",
        "itemSuggestions",
        "benchAdvice",
        "pickupAdvice",
      ],
    },
  };
}

export async function getRecommendation(
  boardDescription: string,
  stats: StatsContext,
  gameData: TftGameData,
  hasHistory: boolean = false
): Promise<Recommendation> {
  const statsBlock =
    stats.source === "real"
      ? `REAL STATS from ${stats.gamesPlayed} real games this patch for comp signature "${stats.compSignature}": ` +
        `avg placement ${stats.avgPlacement?.toFixed(2)}, top4 rate ${(stats.top4Rate! * 100).toFixed(0)}%, ` +
        `win rate ${(stats.winRate! * 100).toFixed(0)}%.\n` +
        (stats.itemBuilds && stats.itemBuilds.length > 0
          ? "Real item build stats for the carry:\n" +
            stats.itemBuilds
              .map(
                (b) =>
                  `- ${b.itemBuild} (${b.gamesPlayed} games): avg placement ${b.avgPlacement.toFixed(2)}, ` +
                  `top4 ${(b.top4Rate * 100).toFixed(0)}%, win ${(b.winRate * 100).toFixed(0)}%`
              )
              .join("\n")
          : "No real item build stats yet for this carry.")
      : `No real stats exist yet for comp signature "${stats.compSignature}" — you must set statsSource ` +
        `to "estimated" and sampleSize to null, and reason from general TFT strategy knowledge instead.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "You are a Teamfight Tactics coach giving advice to a player who is actively mid-game and " +
      "needs a fast, direct answer — not an essay. You MUST report your recommendation using the " +
      "report_recommendation tool, keeping every free-text field to one short, specific sentence " +
      "each — this is a set of scannable facts, not a paragraph. Always fill benchAdvice for every " +
      "real champion on the bench, and pickupAdvice whenever a pickup is held — these are easy to " +
      "forget but the player explicitly wants them covered every time, not just when convenient. " +
      "NEVER present an estimate as if it were real statistics — statsSource must accurately reflect " +
      "whether real data was given below. Respond in Spanish for all free-text fields (shortAdvice, " +
      "compDirection, every 'reason', pickupAdvice) — in those, always refer to champions/items by " +
      "their real display name (e.g. 'Rakan'), NEVER by their internal apiName (e.g. 'DA_18_Rakan'). " +
      "apiName is only for the dedicated id fields (buyFromShop, priorityChampions, unit, item).\n\n" +
      (hasHistory
        ? "The board description below includes earlier saved snapshots from THIS SAME match, in " +
          "chronological order, before the current state. Use them to understand how the comp/" +
          "items/traits have been evolving — factor that trajectory into your advice (e.g. don't " +
          "suggest abandoning a direction they've already committed heavily to without good reason, " +
          "and feel free to note if they should keep going or pivot given how it's progressed).\n\n"
        : "") +
      "Reference data for the current set:\n" +
      formatGameDataForPrompt(gameData),
    tools: [buildRecommendationTool(gameData)],
    tool_choice: { type: "tool", name: "report_recommendation" },
    messages: [
      {
        role: "user",
        content: `${boardDescription}\n\n${statsBlock}\n\nRecommend what to do next.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a report_recommendation tool call");
  }
  const recommendation = normalizeRecommendation(toolUse.input as Partial<Recommendation>);

  if (!recommendation.shortAdvice) {
    // Diagnostic for the "blank recommendation card" failure mode seen
    // live — logs everything needed to tell apart a truncated response
    // (stop_reason "max_tokens") from the model just omitting fields.
    console.error(
      "getRecommendation: shortAdvice came back empty.",
      "stop_reason:", response.stop_reason,
      "raw tool input:", JSON.stringify(toolUse.input)
    );
  }

  return recommendation;
}

function normalizeRecommendation(input: Partial<Recommendation>): Recommendation {
  return {
    shortAdvice: input.shortAdvice ?? "",
    buyFromShop: input.buyFromShop ?? [],
    compDirection: input.compDirection ?? "",
    statsSource: input.statsSource ?? "estimated",
    sampleSize: input.sampleSize ?? null,
    priorityChampions: input.priorityChampions ?? [],
    itemSuggestions: (input.itemSuggestions ?? []).map((s) => ({
      unit: s.unit ?? "",
      item: s.item ?? "",
      reason: s.reason ?? "",
    })),
    benchAdvice: (input.benchAdvice ?? []).map((b) => ({
      unit: b.unit ?? "",
      action: b.action ?? "mantener",
      reason: b.reason ?? "",
    })),
    pickupAdvice: input.pickupAdvice ?? null,
  };
}
