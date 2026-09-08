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

// Champion/trait/item names must match what the player actually sees in
// their client, not an internal English ID — otherwise recommendations
// name things the player has never seen. es_ar matches LAS's client
// translations (verified against a real screenshot: "Bosqueviejo",
// "Fuegorrápido" — es_es uses different wording, e.g. "Bosque ancestral").
const TFT_LOCALE = process.env.TFT_LOCALE ?? "es_ar";
const COMMUNITY_DRAGON_TFT_DATA_URL = `https://raw.communitydragon.org/latest/cdragon/tft/${TFT_LOCALE}.json`;

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

export interface TftPickup {
  apiName: string;
  name: string;
  iconUrl?: string;
  description: string;
}

export interface TftGameData {
  setNumber: number;
  champions: TftChampion[];
  traits: TftTrait[];
  items: TftItem[];
  pickups: TftPickup[];
}

/**
 * Carousel/round "pickup" rewards — anvils, the trait emblem tome, the
 * mercenary chest. These are generic mechanics reused across sets (not
 * set-specific balance data), so their apiNames and meaning are hardcoded
 * here rather than sourced from Community Dragon. They show up in the same
 * zero-trait champion list as PvE creatures (see the filter below) but,
 * unlike those, players do pick them up and hold them on the bench — the
 * player asked to be able to add these manually since the vision model
 * was never asked to (and shouldn't try to) read them from a screenshot.
 */
const PICKUP_DESCRIPTIONS: Record<string, string> = {
  TFT_ArmoryKeyComponent: "Grants a choice of a random item component.",
  TFT_ArmoryKeyCompleted: "Grants a choice of a random completed item.",
  TFT_ArmoryKeyOrnn: "Grants a choice of a powerful Ornn/artifact item.",
  TFT_ArmoryKeySupport: "Grants a choice of a support item.",
  TFT5_EmblemArmoryKey: "Grants a choice of a trait emblem.",
  TFT6_MercenaryChest: "Grants a random reward (gold, items, or similar).",
};

/**
 * Community Dragon's es_ar/es_mx/es_es translations sometimes lag behind
 * the live client (verified: none of them say "Hadístico" for DA_18_Fae —
 * es_ar/es_mx say "Hadas", es_es says "Hada"). Since we can't fix Riot's
 * community mirror, known mismatches get corrected here as they're found.
 * Add entries as apiName -> the name the live client actually shows.
 */
const TRAIT_NAME_OVERRIDES: Record<string, string> = {
  DA_18_Fae: "Hadístico",
};

/** Renames a trait consistently everywhere it's referenced — the trait's
 * own `name` AND every champion's `traits` list, which stores names, not
 * apiNames (see computeActiveTraits) — so activation matching still works
 * after the override. Mutates in place. */
function applyTraitNameOverrides(setData: {
  traits: Array<{ apiName: string; name: string }>;
  champions: Array<{ traits: string[] }>;
}): void {
  for (const trait of setData.traits) {
    const override = TRAIT_NAME_OVERRIDES[trait.apiName];
    if (!override || trait.name === override) continue;

    const oldName = trait.name;
    trait.name = override;
    for (const champ of setData.champions) {
      champ.traits = champ.traits.map((t) => (t === oldName ? override : t));
    }
  }
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
      tileIcon?: string;
    }>;
    traits: Array<{
      apiName: string;
      name: string;
      icon?: string;
      effects: Array<{ minUnits: number; maxUnits: number; style: number }>;
    }>;
  };

  applyTraitNameOverrides(setData);

  // `sets` has no item list of its own; the top-level `items` list spans
  // every set ever released (thousands), so scope it down using the
  // matching core mutator entry in `setData`, which does list just the
  // current set's item API names.
  const coreMutator = `TFTSet${setNumber}`;
  const coreSetEntry = (raw.setData as Array<{ mutator: string; items: string[] }>).find(
    (sd) => sd.mutator === coreMutator
  );
  const currentItemNames = new Set(coreSetEntry?.items ?? []);
  const allItems = raw.items as Array<{ apiName: string; name: string | null; icon?: string }>;
  const namedItems = (
    currentItemNames.size > 0
      ? allItems.filter((item) => currentItemNames.has(item.apiName))
      : allItems
  )
    // A couple of junk entries (a blank/placeholder item icon, an augment
    // mixed into the item list) have name: null — verified live, this
    // crashed a name sort. Real items always have a real name.
    .filter((item): item is { apiName: string; name: string; icon?: string } => Boolean(item.name))
    // "_Assist_" entries (verified live, 65 of them: "34 de oro", "N
    // campeones de X costo", "Yunque de X" again...) are augment/portal
    // reward bundles that get auto-granted and consumed — never something
    // the player picks up and holds — so they don't belong in a "loose
    // items in your bag" picker at all.
    .filter((item) => !item.apiName.includes("_Assist_"))
    // Limited-use consumables (e.g. Limpiador Magnético) have one entry
    // PER remaining-charge count, with the count baked into the name as
    // literal markup — verified live, "lim" surfaced 10 near-identical
    // "Limpiador Magnético <rules>(¡N usos restantes!)</rules>" options
    // alongside the one real entry, "Limpiador Magnético". The player
    // only ever needs to add the fresh/full-charge item, so drop every
    // variant carrying this markup rather than try to keep "the right"
    // charge count.
    .filter((item) => !/<[a-z]+>/i.test(item.name));

  // Many of these share a display name with another apiName: most often a
  // generic cross-set item vs this set's identically-named reskin (e.g.
  // "Sombrero Mortífero de Rabadon" as both TFT_Item_RabadonsDeathcap and
  // DA_RabadonsDeathcap), but verified live there's also at least one pure
  // translation inconsistency (same icon, "Duplicador de campeón menor"
  // vs "Duplicador de Campeón menor" — only the capitalization differs).
  // Compare case-insensitively so both collapse into one; keep the first
  // apiName seen per name.
  const seenNames = new Set<string>();
  const scopedItems = namedItems.filter((item) => {
    const key = item.name.toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Community Dragon's champion list also includes non-playable entries —
  // PvE jungle creatures (Golem, Murkwolf, Crab...) and carousel pickup
  // icons (component/item anvils, trait tome...) — which real champions
  // never have: every real playable champion has at least one trait, these
  // all have none. Excluding them stops the vision model from ever
  // confusing a small/distant player champion for one of these (seen live:
  // a real Veigar misread as the "Murkwolf" jungle creature).
  const playableChampions = setData.champions.filter((champ) => champ.traits.length > 0);
  const pickups = setData.champions.filter((champ) => champ.apiName in PICKUP_DESCRIPTIONS);

  // Most champions have squareIcon, but the armory-key pickups (verified
  // live: their icons were showing broken) only have tileIcon. Community
  // Dragon also represents some missing fields as the literal string
  // "None" rather than a real null/absent value — also verified live, it's
  // what caused the broken icons — so that has to be filtered out too.
  const isRealPath = (path?: string) => Boolean(path) && path!.toLowerCase() !== "none";
  const iconUrlFor = (entity: { squareIcon?: string; tileIcon?: string }) => {
    const path = isRealPath(entity.squareIcon) ? entity.squareIcon : entity.tileIcon;
    return isRealPath(path) ? communityDragonAssetUrl(path!) : undefined;
  };

  const data: TftGameData = {
    setNumber,
    pickups: pickups.map((p) => ({
      apiName: p.apiName,
      name: p.name,
      iconUrl: iconUrlFor(p),
      description: PICKUP_DESCRIPTIONS[p.apiName],
    })),
    champions: playableChampions.map((champ) => ({
      apiName: champ.apiName,
      name: champ.name,
      traits: champ.traits,
      cost: champ.cost,
      iconUrl: iconUrlFor(champ),
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

/** Just the champion list — for the screenshot-reading call, which only
 * ever needs to name shop champions now (see buildBoardTool). Cheaper
 * than the full reference block since it skips ~770 items it never uses. */
export function formatChampionsForPrompt(data: TftGameData): string {
  const champLines = data.champions
    .map((c) => `${c.name} (${c.apiName}) [${c.traits.join(", ")}]`)
    .join("\n");
  return ["CHAMPIONS:", champLines].join("\n");
}

/** Compact text block listing current champions/traits/items by name, for
 * grounding the vision model's prompt so it maps icons to real current-set
 * names instead of guessing from potentially stale training data. */
export function formatGameDataForPrompt(data: TftGameData): string {
  const champLines = data.champions
    .map((c) => `${c.name} (${c.apiName}) [${c.traits.join(", ")}]`)
    .join("\n");
  const itemLines = data.items.map((i) => `${i.name} (${i.apiName})`).join("\n");
  const pickupLines = data.pickups
    .map((p) => `${p.name} (${p.apiName}): ${p.description}`)
    .join("\n");

  return [
    "CHAMPIONS:",
    champLines,
    "",
    "ITEMS:",
    itemLines,
    "",
    "PICKUPS the player may be holding on the bench (anvils, tome, chest — not combat units):",
    pickupLines,
  ].join("\n");
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
