"""Public, key-free TFT game data (patch version, champions, traits, items)
sourced from Riot's Data Dragon and Community Dragon. Used to label raw IDs
found in match data with human-readable names/icons, and to know the
current patch independently of what's in the matches table yet.
"""

import httpx

DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
COMMUNITY_DRAGON_TFT_DATA_URL = (
    "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json"
)


def get_latest_patch() -> str:
    """Latest League/TFT client patch version, e.g. '14.18.1'."""
    response = httpx.get(DDRAGON_VERSIONS_URL, timeout=10.0)
    response.raise_for_status()
    versions: list[str] = response.json()
    return versions[0]


def get_tft_game_data() -> dict:
    """Champions, traits (with tier breakpoints), and items for the current
    live TFT set.

    Community Dragon's top-level shape is {"items": [...], "setData": [...],
    "sets": {"1": {...}, ..., "18": {...}}}. `sets` is keyed by set number
    and only holds the clean, current data for each notable set (no
    PVE/turbo/pairs variants, unlike the messier `setData` list) — the
    highest numeric key is the live set. This matches what real match data
    reports as `info.tft_set_number`.
    """
    response = httpx.get(COMMUNITY_DRAGON_TFT_DATA_URL, timeout=15.0)
    response.raise_for_status()
    raw = response.json()

    set_number = max(int(key) for key in raw["sets"])
    set_data = raw["sets"][str(set_number)]

    # `sets` has no item list of its own; the top-level `items` list spans
    # every set ever released (thousands), so scope it down using the
    # matching core mutator entry in `setData`, which does list just the
    # current set's item API names.
    core_mutator = f"TFTSet{set_number}"
    core_set = next(sd for sd in raw["setData"] if sd["mutator"] == core_mutator)
    current_item_names = set(core_set["items"])
    items = [item for item in raw["items"] if item["apiName"] in current_item_names]

    return {
        "set_number": set_number,
        "champions": set_data["champions"],
        "traits": set_data["traits"],
        "items": items,
    }
