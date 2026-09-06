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
    """Full current-set TFT static data: champions, traits, items, augments.

    Community Dragon's "latest" alias tracks live TFT data (updates faster
    than Data Dragon for mid-set balance changes), so prefer this for
    champion/trait/item lookups.
    """
    response = httpx.get(COMMUNITY_DRAGON_TFT_DATA_URL, timeout=15.0)
    response.raise_for_status()
    return response.json()
