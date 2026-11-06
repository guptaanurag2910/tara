from __future__ import annotations

from typing import Dict, Mapping

from .nakshatra_data import (
    NAKSHATRA_TO_GANA,
    NAKSHATRA_TO_INDEX,
    NAKSHATRA_TO_NADI,
    NAKSHATRA_TO_YONI,
    normalize_nakshatra,
)

MAX_KOOTA_SCORE = {
    "varna": 1,
    "vashya": 2,
    "tara": 3,
    "yoni": 4,
    "graha_maitri": 5,
    "gana": 6,
    "bhakoot": 7,
    "nadi": 8,
}

RASHI_ORDER = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
]
RASHI_TO_INDEX = {name: idx + 1 for idx, name in enumerate(RASHI_ORDER)}

RASHI_TO_LORD = {
    "aries": "mars",
    "taurus": "venus",
    "gemini": "mercury",
    "cancer": "moon",
    "leo": "sun",
    "virgo": "mercury",
    "libra": "venus",
    "scorpio": "mars",
    "sagittarius": "jupiter",
    "capricorn": "saturn",
    "aquarius": "saturn",
    "pisces": "jupiter",
}

RASHI_TO_VARNA = {
    "aries": "kshatriya",
    "taurus": "vaishya",
    "gemini": "shudra",
    "cancer": "brahmin",
    "leo": "kshatriya",
    "virgo": "vaishya",
    "libra": "shudra",
    "scorpio": "brahmin",
    "sagittarius": "kshatriya",
    "capricorn": "vaishya",
    "aquarius": "shudra",
    "pisces": "brahmin",
}

RASHI_TO_VASHYA = {
    "aries": "chatushpada",
    "taurus": "chatushpada",
    "gemini": "manava",
    "cancer": "jalachara",
    "leo": "vanachara",
    "virgo": "manava",
    "libra": "manava",
    "scorpio": "keeta",
    "sagittarius": "chatushpada",
    "capricorn": "chatushpada",
    "aquarius": "manava",
    "pisces": "jalachara",
}

VARNA_RANK = {
    "shudra": 1,
    "vaishya": 2,
    "kshatriya": 3,
    "brahmin": 4,
}

VASHYA_MATRIX = {
    ("chatushpada", "chatushpada"): 2,
    ("manava", "manava"): 2,
    ("jalachara", "jalachara"): 2,
    ("vanachara", "vanachara"): 2,
    ("keeta", "keeta"): 2,
    ("chatushpada", "manava"): 1,
    ("manava", "jalachara"): 1,
    ("chatushpada", "jalachara"): 1,
    ("vanachara", "chatushpada"): 1,
    ("jalachara", "keeta"): 1,
}

PLANET_RELATIONS = {
    "sun": {"friend": {"moon", "mars", "jupiter"}, "neutral": {"mercury"}, "enemy": {"venus", "saturn"}},
    "moon": {"friend": {"sun", "mercury"}, "neutral": {"mars", "jupiter", "venus", "saturn"}, "enemy": set()},
    "mars": {"friend": {"sun", "moon", "jupiter"}, "neutral": {"venus", "saturn"}, "enemy": {"mercury"}},
    "mercury": {"friend": {"sun", "venus"}, "neutral": {"mars", "jupiter", "saturn"}, "enemy": {"moon"}},
    "jupiter": {"friend": {"sun", "moon", "mars"}, "neutral": {"saturn"}, "enemy": {"mercury", "venus"}},
    "venus": {"friend": {"mercury", "saturn"}, "neutral": {"mars", "jupiter"}, "enemy": {"sun", "moon"}},
    "saturn": {"friend": {"mercury", "venus"}, "neutral": {"jupiter"}, "enemy": {"sun", "moon", "mars"}},
}

GANA_MATRIX = {
    ("deva", "deva"): 6,
    ("manushya", "manushya"): 6,
    ("rakshasa", "rakshasa"): 6,
    ("deva", "manushya"): 6,
    ("manushya", "deva"): 5,
    ("manushya", "rakshasa"): 0,
    ("rakshasa", "manushya"): 0,
    ("deva", "rakshasa"): 0,
    ("rakshasa", "deva"): 1,
}

YONI_FRIENDLY_PAIRS = {
    frozenset({"horse", "elephant"}),
    frozenset({"cow", "buffalo"}),
    frozenset({"cat", "deer"}),
    frozenset({"dog", "monkey"}),
    frozenset({"lion", "tiger"}),
    frozenset({"rat", "mongoose"}),
}
YONI_ENEMY_PAIRS = {
    frozenset({"serpent", "mongoose"}),
    frozenset({"cat", "rat"}),
    frozenset({"lion", "elephant"}),
    frozenset({"deer", "dog"}),
}

def _norm(value) -> str:
    text = str(value or "").strip().lower()
    return "".join(ch for ch in text if ch.isalnum())


def _canonical_nakshatra_key(value: str) -> str:
    return normalize_nakshatra(value)


def _canonical_sign_key(value: str) -> str:
    return _norm(value)


def _resolve_rashi_lord(moon_sign: str, provided_rashi_lord: str | None) -> str:
    lord = _norm(provided_rashi_lord)
    if lord:
        return lord
    sign_key = _canonical_sign_key(moon_sign)
    return RASHI_TO_LORD.get(sign_key, "")


def _lookup_nakshatra_index(nakshatra: str) -> int:
    key = _canonical_nakshatra_key(nakshatra)
    return NAKSHATRA_TO_INDEX.get(key, 0)


def _score_varna(user1: Mapping[str, str], user2: Mapping[str, str]) -> int:
    sign_1 = _canonical_sign_key(user1.get("moon_sign", ""))
    sign_2 = _canonical_sign_key(user2.get("moon_sign", ""))
    varna_1 = RASHI_TO_VARNA.get(sign_1, "")
    varna_2 = RASHI_TO_VARNA.get(sign_2, "")
    rank_1 = VARNA_RANK.get(varna_1, 0)
    rank_2 = VARNA_RANK.get(varna_2, 0)
    if rank_1 == 0 or rank_2 == 0:
        return 0
    return MAX_KOOTA_SCORE["varna"] if rank_1 >= rank_2 else 0


def _score_vashya(user1: Mapping[str, str], user2: Mapping[str, str]) -> int:
    sign_1 = _canonical_sign_key(user1.get("moon_sign", ""))
    sign_2 = _canonical_sign_key(user2.get("moon_sign", ""))
    vashya_1 = RASHI_TO_VASHYA.get(sign_1, "")
    vashya_2 = RASHI_TO_VASHYA.get(sign_2, "")
    if not vashya_1 or not vashya_2:
        return 0
    if (vashya_1, vashya_2) in VASHYA_MATRIX:
        return VASHYA_MATRIX[(vashya_1, vashya_2)]
    if (vashya_2, vashya_1) in VASHYA_MATRIX:
        return VASHYA_MATRIX[(vashya_2, vashya_1)]
    return 0


def _tara_is_good(distance: int) -> bool:
    tara_number = ((distance - 1) % 9) + 1
    return tara_number not in {3, 5, 7}


def _score_tara(user1: Mapping[str, str], user2: Mapping[str, str]) -> float:
    idx_1 = _lookup_nakshatra_index(user1.get("nakshatra", ""))
    idx_2 = _lookup_nakshatra_index(user2.get("nakshatra", ""))
    if idx_1 == 0 or idx_2 == 0:
        return 0

    distance_1_to_2 = ((idx_2 - idx_1) % 27) + 1
    distance_2_to_1 = ((idx_1 - idx_2) % 27) + 1

    good_count = int(_tara_is_good(distance_1_to_2)) + int(_tara_is_good(distance_2_to_1))
    if good_count == 2:
        return 3.0
    if good_count == 1:
        return 1.5
    return 0.0


def _score_yoni(user1: Mapping[str, str], user2: Mapping[str, str]) -> int:
    key_1 = _canonical_nakshatra_key(user1.get("nakshatra", ""))
    key_2 = _canonical_nakshatra_key(user2.get("nakshatra", ""))
    yoni_1 = NAKSHATRA_TO_YONI.get(key_1, "")
    yoni_2 = NAKSHATRA_TO_YONI.get(key_2, "")
    if not yoni_1 or not yoni_2:
        return 0
    if yoni_1 == yoni_2:
        return 4
    pair = frozenset({yoni_1, yoni_2})
    if pair in YONI_ENEMY_PAIRS:
        return 0
    if pair in YONI_FRIENDLY_PAIRS:
        return 3
    return 2


def _planet_relation(source: str, target: str) -> int:
    relation = PLANET_RELATIONS.get(source, {})
    if target in relation.get("friend", set()):
        return 1
    if target in relation.get("neutral", set()):
        return 0
    return -1


def _score_graha_maitri(user1: Mapping[str, str], user2: Mapping[str, str]) -> int:
    lord_1 = _resolve_rashi_lord(user1.get("moon_sign", ""), user1.get("rashi_lord"))
    lord_2 = _resolve_rashi_lord(user2.get("moon_sign", ""), user2.get("rashi_lord"))
    if not lord_1 or not lord_2:
        return 0
    if lord_1 == lord_2:
        return 5

    rel_1 = _planet_relation(lord_1, lord_2)
    rel_2 = _planet_relation(lord_2, lord_1)
    normalized = (rel_1 + rel_2 + 2) / 4.0
    return int(round(normalized * MAX_KOOTA_SCORE["graha_maitri"]))


def _score_gana(user1: Mapping[str, str], user2: Mapping[str, str]) -> float:
    key_1 = _canonical_nakshatra_key(user1.get("nakshatra", ""))
    key_2 = _canonical_nakshatra_key(user2.get("nakshatra", ""))
    gana_1 = NAKSHATRA_TO_GANA.get(key_1, "")
    gana_2 = NAKSHATRA_TO_GANA.get(key_2, "")
    if not gana_1 or not gana_2:
        return 0
    if gana_1 == gana_2:
        return 6.0
    # Gana tables are traditionally directional by groom/bride. This API
    # accepts two equivalent profiles without gender roles, so average both
    # directions instead of making the result depend on request ordering.
    forward = GANA_MATRIX.get((gana_1, gana_2), 0)
    reverse = GANA_MATRIX.get((gana_2, gana_1), 0)
    return (float(forward) + float(reverse)) / 2.0


def _score_bhakoot(user1: Mapping[str, str], user2: Mapping[str, str]) -> int:
    sign_1 = _canonical_sign_key(user1.get("moon_sign", ""))
    sign_2 = _canonical_sign_key(user2.get("moon_sign", ""))
    idx_1 = RASHI_TO_INDEX.get(sign_1, 0)
    idx_2 = RASHI_TO_INDEX.get(sign_2, 0)
    if idx_1 == 0 or idx_2 == 0:
        return 0

    diff = abs(idx_1 - idx_2)
    circular_diff = min(diff, len(RASHI_ORDER) - diff)
    if circular_diff in {1, 4, 5}:  # 2-12, 5-9, and 6-8 relationships
        return 0
    return MAX_KOOTA_SCORE["bhakoot"]


def _score_nadi(user1: Mapping[str, str], user2: Mapping[str, str]) -> int:
    key_1 = _canonical_nakshatra_key(user1.get("nakshatra", ""))
    key_2 = _canonical_nakshatra_key(user2.get("nakshatra", ""))
    nadi_1 = NAKSHATRA_TO_NADI.get(key_1, "")
    nadi_2 = NAKSHATRA_TO_NADI.get(key_2, "")
    if not nadi_1 or not nadi_2:
        return 0
    return 0 if nadi_1 == nadi_2 else MAX_KOOTA_SCORE["nadi"]


def compatibility_label(total_score: int) -> str:
    if total_score >= 30:
        return "Excellent"
    if total_score >= 24:
        return "Good"
    if total_score >= 18:
        return "Average"
    return "Not recommended"


def calculate_ashta_koota_match(user1: Mapping[str, str], user2: Mapping[str, str]) -> Dict[str, object]:
    breakdown = {
        "varna": _score_varna(user1, user2),
        "vashya": _score_vashya(user1, user2),
        "tara": _score_tara(user1, user2),
        "yoni": _score_yoni(user1, user2),
        "graha_maitri": _score_graha_maitri(user1, user2),
        "gana": _score_gana(user1, user2),
        "bhakoot": _score_bhakoot(user1, user2),
        "nadi": _score_nadi(user1, user2),
    }
    total_score = round(sum(breakdown.values()), 2)
    return {
        "total_score": total_score,
        "compatibility": compatibility_label(total_score),
        "breakdown": breakdown,
    }

