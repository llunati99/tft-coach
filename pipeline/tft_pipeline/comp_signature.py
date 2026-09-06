"""Derives a coarse "comp signature" from a match participant, since exact
unit-by-unit compositions are too varied to group literally. A signature is
the participant's top active traits plus their most-invested carry unit —
close enough to how players actually talk about comps ("Bruisers Jinx").
"""

TOP_TRAIT_COUNT = 2


def carry_unit(participant: dict) -> str:
    units = participant.get("units", [])
    if not units:
        return "unknown"

    def item_count(unit: dict) -> int:
        return len(unit.get("itemNames") or unit.get("items") or [])

    return max(units, key=lambda unit: (item_count(unit), unit.get("tier", 0)))[
        "character_id"
    ]


def comp_signature(participant: dict) -> str:
    traits = [t for t in participant.get("traits", []) if t.get("tier_current", 0) > 0]
    traits.sort(key=lambda t: (t["tier_current"], t.get("num_units", 0)), reverse=True)
    top_traits = [t["name"] for t in traits[:TOP_TRAIT_COUNT]]

    return "+".join([*top_traits, carry_unit(participant)])


def item_build(participant: dict, unit_character_id: str) -> str | None:
    for unit in participant.get("units", []):
        if unit.get("character_id") == unit_character_id:
            items = sorted(unit.get("itemNames") or unit.get("items") or [])
            return "+".join(items) if items else None
    return None
