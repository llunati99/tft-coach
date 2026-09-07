import { NextResponse } from "next/server";
import { BoardReading, getRecommendation, StatsContext } from "@/lib/anthropic";
import { carryUnit, compSignature } from "@/lib/compSignature";
import { getCompStats, getItemStats } from "@/lib/db";
import { computeActiveTraits, getTftGameData, type TftGameData } from "@/lib/staticData";

const MAX_HISTORY_SNAPSHOTS = 8;

function describeBoardFull(board: BoardReading, gameData: TftGameData, label: string): string {
  const activeTraits = computeActiveTraits(
    board.units.map((u) => u.apiName),
    gameData
  ).filter((t) => t.tierCurrent > 0);
  const pickupApiNames = new Set(gameData.pickups.map((p) => p.apiName));

  const unitLines = board.units
    .map((u) => `- ${u.apiName} (${u.star}★)${u.items.length ? ` con ${u.items.join(", ")}` : ""}`)
    .join("\n");
  const benchLines = board.bench
    .map((u) => (pickupApiNames.has(u.apiName) ? `- ${u.apiName} (pickup, sin usar)` : `- ${u.apiName} (${u.star}★)`))
    .join("\n");
  const traitLines = activeTraits.map((t) => `- ${t.name}: ${t.numUnits} unidades (tier ${t.tierCurrent})`).join("\n");

  return [
    `=== ${label} ===`,
    `Nivel ${board.level}, oro ${board.gold}, stage ${board.stage}`,
    board.rerollCost === 0
      ? "¡El próximo rerroll es GRATIS (cuesta 0 de oro)! — mencionalo si conviene aprovecharlo."
      : `Costo del próximo rerroll: ${board.rerollCost ?? "no visible"}`,
    board.augments.length ? `Aumentos: ${board.augments.join(", ")}` : "Aumentos: (no visibles)",
    "Tienda actual:",
    board.shop.length ? board.shop.join(", ") : "(vacía o no visible)",
    "Items sueltos sin equipar (item bag):",
    board.looseItems.length ? board.looseItems.join(", ") : "(ninguno)",
    "Unidades en el tablero:",
    unitLines || "(ninguna)",
    "Sinergias activas:",
    traitLines || "(ninguna)",
    "Banca:",
    benchLines || "(vacía)",
  ].join("\n");
}

export async function POST(request: Request) {
  const body = await request.json();
  const board = body.board as BoardReading | undefined;
  const history = (body.history as BoardReading[] | undefined) ?? [];

  if (!board) {
    return NextResponse.json({ error: "Falta 'board' en el cuerpo de la petición." }, { status: 400 });
  }

  const gameData = await getTftGameData();
  const boardCharacterIds = board.units.map((u) => u.apiName);
  const activeTraits = computeActiveTraits(boardCharacterIds, gameData);

  const boardUnits = board.units.map((u) => ({
    characterId: u.apiName,
    itemNames: u.items,
    tier: u.star,
  }));
  const boardState = {
    traits: activeTraits.map((t) => ({ name: t.name, tierCurrent: t.tierCurrent, numUnits: t.numUnits })),
    units: boardUnits,
  };
  const signature = compSignature(boardState);
  const carry = carryUnit(boardState);

  const compStatsRow = await getCompStats(signature);
  const itemStatsRows = compStatsRow ? await getItemStats(signature, carry) : [];

  const statsContext: StatsContext = compStatsRow
    ? {
        source: "real",
        compSignature: signature,
        gamesPlayed: compStatsRow.gamesPlayed,
        avgPlacement: compStatsRow.avgPlacement,
        top4Rate: compStatsRow.top4Rate,
        winRate: compStatsRow.winRate,
        itemBuilds: itemStatsRows.map((row) => ({
          itemBuild: row.itemBuild,
          gamesPlayed: row.gamesPlayed,
          avgPlacement: row.avgPlacement,
          top4Rate: row.top4Rate,
          winRate: row.winRate,
        })),
      }
    : { source: "none", compSignature: signature };

  const recentHistory = history.slice(-MAX_HISTORY_SNAPSHOTS);
  const historyBlock = recentHistory
    .map((snap, i) => describeBoardFull(snap, gameData, `Captura guardada #${i + 1} de ${recentHistory.length} (stage ${snap.stage})`))
    .join("\n\n");
  const currentBlock = describeBoardFull(board, gameData, "Estado actual (más reciente)");
  const boardDescription = historyBlock ? `${historyBlock}\n\n${currentBlock}` : currentBlock;

  try {
    const recommendation = await getRecommendation(boardDescription, statsContext, gameData, recentHistory.length > 0);
    return NextResponse.json({ recommendation, compSignature: signature, carryUnit: carry, statsContext });
  } catch (error) {
    console.error("recommend failed:", error);
    return NextResponse.json({ error: "No se pudo generar la recomendación." }, { status: 502 });
  }
}
