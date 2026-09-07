import Anthropic from "@anthropic-ai/sdk";

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
  gold: number;
  level: number;
  stage: string;
  augments: string[];
}

const BOARD_TOOL = {
  name: "report_board",
  description: "Report the Teamfight Tactics board state read from the screenshot.",
  input_schema: {
    type: "object" as const,
    properties: {
      units: {
        type: "array",
        description: "Champions currently placed on the board (not the bench).",
        items: {
          type: "object",
          properties: {
            apiName: { type: "string", description: "Champion apiName from the provided list." },
            star: { type: "integer", description: "Star level: 1, 2, or 3." },
            items: {
              type: "array",
              items: { type: "string" },
              description: "Item apiNames equipped, from the provided list. Empty if none.",
            },
          },
          required: ["apiName", "star", "items"],
        },
      },
      bench: {
        type: "array",
        description: "Champions on the bench (not placed on board).",
        items: {
          type: "object",
          properties: {
            apiName: { type: "string" },
            star: { type: "integer" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["apiName", "star", "items"],
        },
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
    required: ["units", "bench", "gold", "level", "stage", "augments"],
  },
};

export async function analyzeScreenshot(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp",
  gameDataPrompt: string
): Promise<BoardReading> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "You read Teamfight Tactics screenshots and report the exact board state using the " +
      "report_board tool. Only use champion/item apiNames from the reference list provided — " +
      "never invent names or use ones from other TFT sets. If something isn't visible, use your " +
      "best reading rather than guessing wildly, but do not fabricate units/items that aren't there.\n\n" +
      "Reference data for the current set:\n" +
      gameDataPrompt,
    tools: [BOARD_TOOL],
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
  compDirection: string;
  statsSource: "real" | "estimated";
  sampleSize: number | null;
  priorityChampions: string[];
  itemSuggestions: Array<{ unit: string; item: string; reason: string }>;
  reasoning: string;
}

const RECOMMENDATION_TOOL = {
  name: "report_recommendation",
  description: "Report a structured TFT recommendation for the current board.",
  input_schema: {
    type: "object" as const,
    properties: {
      compDirection: { type: "string", description: "The comp direction being recommended, in plain language." },
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
        items: { type: "string" },
        description: "Champion apiNames worth prioritizing buying/leveling for next.",
      },
      itemSuggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unit: { type: "string", description: "Champion apiName to receive the item." },
            item: { type: "string", description: "Item apiName to build." },
            reason: { type: "string" },
          },
          required: ["unit", "item", "reason"],
        },
      },
      reasoning: { type: "string", description: "Short plain-language explanation, in Spanish." },
    },
    required: ["compDirection", "statsSource", "sampleSize", "priorityChampions", "itemSuggestions", "reasoning"],
  },
};

export async function getRecommendation(
  boardDescription: string,
  stats: StatsContext,
  gameDataPrompt: string
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
      "You are a Teamfight Tactics coach. You MUST report your recommendation using the " +
      "report_recommendation tool. NEVER present an estimate as if it were real statistics — " +
      "statsSource must accurately reflect whether real data was given below. Respond in Spanish " +
      "for all free-text fields.\n\n" +
      "Reference data for the current set:\n" +
      gameDataPrompt,
    tools: [RECOMMENDATION_TOOL],
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
