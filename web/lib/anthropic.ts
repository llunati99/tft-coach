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
  gold: number;
  level: number;
  stage: string;
  augments: string[];
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
        gold: { type: "integer", description: "Current gold available." },
        level: { type: "integer", description: "Current board level." },
        stage: { type: "string", description: "Current stage-round, e.g. '3-2'." },
        augments: {
          type: "array",
          items: { type: "string" },
          description: "Augment names visible/known to be active, if any. Empty if not visible.",
        },
      },
      required: ["units", "bench", "shop", "gold", "level", "stage", "augments"],
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
      "report_board tool, including the shop row at the bottom (the champions currently offered " +
      "for purchase) — this is critical, players check this screen mainly to decide what to buy.\n\n" +
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
  return toolUse.input as BoardReading;
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

export interface Recommendation {
  shortAdvice: string;
  buyFromShop: string[];
  compDirection: string;
  statsSource: "real" | "estimated";
  sampleSize: number | null;
  priorityChampions: string[];
  itemSuggestions: Array<{ unit: string; item: string; reason: string }>;
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
      },
      required: [
        "shortAdvice",
        "buyFromShop",
        "compDirection",
        "statsSource",
        "sampleSize",
        "priorityChampions",
        "itemSuggestions",
      ],
    },
  };
}

export async function getRecommendation(
  boardDescription: string,
  stats: StatsContext,
  gameData: TftGameData
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
      "report_recommendation tool, keeping shortAdvice to one short, specific sentence. NEVER " +
      "present an estimate as if it were real statistics — statsSource must accurately reflect " +
      "whether real data was given below. Respond in Spanish for all free-text fields.\n\n" +
      "Reference data for the current set:\n" +
      formatGameDataForPrompt(gameData),
    tools: [buildRecommendationTool(gameData)],
    tool_choice: { type: "tool", name: "report_recommendation" },
    messages: [
      {
        role: "user",
        content: `Current board:\n${boardDescription}\n\n${statsBlock}\n\nRecommend what to do next.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a report_recommendation tool call");
  }
  return toolUse.input as Recommendation;
}
