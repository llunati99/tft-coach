/**
 * Public, key-free TFT game data (patch version, champions, traits, items)
 * sourced from Riot's Data Dragon and Community Dragon. Mirrors
 * pipeline/tft_pipeline/static_data.py — used here to ground the vision
 * model's screenshot reading in real current-patch names, to render icons
 * in the UI, and to compute trait tiers ourselves from champion counts
 * (see computeActiveTraits below) instead of asking the vision model to
 * read the small synergy panel numbers, which is much more error-prone.
 */

const DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const COMMUNITY_DRAGON_TFT_DATA_URL =
  "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";

/** Converts a raw game asset path (as found in champion/trait/item data,
 * e.g. "ASSETS/Characters/.../Foo.tft_set18.tex") into a real, fetchable
 * Community Dragon CDN URL. Verified against live assets — see the checks
 * this was validated with before relying on it. */
export function communityDragonAssetUrl(assetPath: string): string {
  return `https://raw.communitydragon.org/latest/game/${assetPath
    .toLowerCase()
    .replace(/\.tex$/, ".png")
    .replace(/\.dds$/, ".png")}`;
}

export interface TftChampion {
  apiName: string;
  name: string;
  traits: string[];
  cost?: number;
  iconUrl?: string;
}

export interface TftTraitEffect {
  minUnits: number;
  maxUnits: number;
  style: number;
}

export interface TftTrait {
  apiName: string;
  name: string;
  effects: TftTraitEffect[];
  iconUrl?: string;
}

export interface TftItem {
  apiName: string;
  name: string;
  iconUrl?: string;
}

export interface TftGameData {
  setNumber: number;
  champions: TftChampion[];
  traits: TftTrait[];
  items: TftItem[];
}

let cachedGameData: { data: TftGameData; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — patch data doesn't change fast enough to refetch every request

export async function getLatestPatch(): Promise<string> {
  const response = await fetch(DDRAGON_VERSIONS_URL);
  if (!response.ok) {
    throw new Error(`Data Dragon versions request failed: ${response.status}`);
  }
  const versions: string[] = await response.json();
  return versions[0];
}

/**
 * Community Dragon's top-level shape is
 * {"items": [...], "setData": [...], "sets": {"1": {...}, ..., "18": {...}}}.
 * `sets` is keyed by set number and only holds the clean, current data for
 * each notable set (no PVE/turbo/pairs variants, unlike the messier
 * `setData` list) — the highest numeric key is the live set. This matches
 * what real match data reports as `info.tft_set_number`.
 */
export async function getTftGameData(): Promise<TftGameData> {
  if (cachedGameData && Date.now() - cachedGameData.fetchedAt < CACHE_TTL_MS) {
    return cachedGameData.data;
  }

  const response = await fetch(COMMUNITY_DRAGON_TFT_DATA_URL);
  if (!response.ok) {
    throw new Error(`Community Dragon TFT data request failed: ${response.status}`);
  }
  const raw = await response.json();

  const setNumber = Math.max(...Object.keys(raw.sets).map((key) => parseInt(key, 10)));
  const setData = raw.sets[String(setNumber)] as {
    champions: Array<{
      apiName: string;
      name: string;
      traits: string[];
      cost?: number;
      squareIcon?: string;
    }>;
    traits: Array<{
      apiName: string;
      name: string;
      icon?: string;
      effects: Array<{ minUnits: number; maxUnits: number; style: number }>;
    }>;
  };

  // `sets` has no item list of its own; the top-level `items` list spans
  // every set ever released (thousands), so scope it down using the
  // matching core mutator entry in `setData`, which does list just the
  // current set's item API names.
  const coreMutator = `TFTSet${setNumber}`;
  const coreSetEntry = (raw.setData as Array<{ mutator: string; items: string[] }>).find(
    (sd) => sd.mutator === coreMutator
  );
  const currentItemNames = new Set(coreSetEntry?.items ?? []);
  const allItems = raw.items as Array<{ apiName: string; name: string; icon?: string }>;
  const scopedItems = currentItemNames.size > 0
    ? allItems.filter((item) => currentItemNames.has(item.apiName))
    : allItems;

  const data: TftGameData = {
    setNumber,
    champions: setData.champions.map((champ) => ({
      apiName: champ.apiName,
      name: champ.name,
      traits: champ.traits,
      cost: champ.cost,
      iconUrl: champ.squareIcon ? communityDragonAssetUrl(champ.squareIcon) : undefined,
    })),
    traits: setData.traits.map((trait) => ({
      apiName: trait.apiName,
      name: trait.name,
      iconUrl: trait.icon ? communityDragonAssetUrl(trait.icon) : undefined,
      effects: trait.effects.map((e) => ({
        minUnits: e.minUnits,
        maxUnits: e.maxUnits,
        style: e.style,
      })),
    })),
    items: scopedItems.map((item) => ({
      apiName: item.apiName,
      name: item.name,
      iconUrl: item.icon ? communityDragonAssetUrl(item.icon) : undefined,
    })),
  };

  cachedGameData = { data, fetchedAt: Date.now() };
  return data;
}

/** Compact text block listing current champions/traits/items by name, for
 * grounding the vision model's prompt so it maps icons to real current-set
 * names instead of guessing from potentially stale training data. */
export function formatGameDataForPrompt(data: TftGameData): string {
  const champLines = data.champions
    .map((c) => `${c.name} (${c.apiName}) [${c.traits.join(", ")}]`)
    .join("\n");
  const itemLines = data.items.map((i) => `${i.name} (${i.apiName})`).join("\n");

  return ["CHAMPIONS:", champLines, "", "ITEMS:", itemLines].join("\n");
}

/**
 * Given the champions currently on a board, computes which traits are
 * active and at what tier — using each trait's real minUnits breakpoints
 * instead of asking a vision model to read the tiny synergy panel numbers.
 */
export function computeActiveTraits(
  boardCharacterIds: string[],
  gameData: TftGameData
): Array<{ name: string; numUnits: number; tierCurrent: number }> {
  const championByApiName = new Map(gameData.champions.map((c) => [c.apiName, c]));
  const countByTrait = new Map<string, number>();

  for (const characterId of boardCharacterIds) {
    const champion = championByApiName.get(characterId);
    if (!champion) continue;
    for (const traitName of champion.traits) {
      countByTrait.set(traitName, (countByTrait.get(traitName) ?? 0) + 1);
    }
  }

  // champion.traits stores each trait's display name (e.g. "Riftbeast"),
  // not its apiName (e.g. "DA_Riftbeast18") — key traits by name to match.
  const traitByName = new Map(gameData.traits.map((t) => [t.name, t]));
  const results: Array<{ name: string; numUnits: number; tierCurrent: number }> = [];

  for (const [traitDisplayName, numUnits] of countByTrait) {
    const trait = traitByName.get(traitDisplayName);
    if (!trait) continue;

    const activeEffect = [...trait.effects]
      .filter((e) => numUnits >= e.minUnits)
      .sort((a, b) => b.minUnits - a.minUnits)[0];

    results.push({
      name: trait.name,
      numUnits,
      tierCurrent: activeEffect ? activeEffect.style : 0,
    });
  }

  return results;
}
