/**
 * TypeScript port of pipeline/tft_pipeline/comp_signature.py. Keep the two
 * in sync — this must derive the exact same signature string as the Python
 * pipeline for a given board, or lookups against comp_stats/item_stats
 * won't match.
 */

const TOP_TRAIT_COUNT = 2;

export interface BoardTrait {
  name: string;
  tierCurrent: number;
  numUnits: number;
}

export interface BoardUnit {
  characterId: string;
  itemNames: string[];
  tier: number;
}

export interface BoardState {
  traits: BoardTrait[];
  units: BoardUnit[];
}

export function carryUnit(board: BoardState): string {
  if (board.units.length === 0) {
    return "unknown";
  }

  return board.units.reduce((best, unit) => {
    const bestKey: [number, number] = [best.itemNames.length, best.tier];
    const unitKey: [number, number] = [unit.itemNames.length, unit.tier];
    return unitKey[0] > bestKey[0] || (unitKey[0] === bestKey[0] && unitKey[1] > bestKey[1])
      ? unit
      : best;
  }).characterId;
}

export function compSignature(board: BoardState): string {
  const activeTraits = board.traits
    .filter((t) => t.tierCurrent > 0)
    .sort((a, b) => b.tierCurrent - a.tierCurrent || b.numUnits - a.numUnits)
    .slice(0, TOP_TRAIT_COUNT)
    .map((t) => t.name);

  return [...activeTraits, carryUnit(board)].join("+");
}

export function itemBuild(board: BoardState, unitCharacterId: string): string | null {
  const unit = board.units.find((u) => u.characterId === unitCharacterId);
  if (!unit || unit.itemNames.length === 0) {
    return null;
  }
  return [...unit.itemNames].sort().join("+");
}
