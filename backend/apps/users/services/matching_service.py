from typing import Dict, Mapping, Optional, Union

from ..models import KundaliProfile, Trait
from .ashta_koota_service import RASHI_TO_LORD, calculate_ashta_koota_match
from .kundali_service import NAKSHATRAS

MAX_GUNA_POINTS = {
    "varna": 1,
    "vashya": 2,
    "tara": 3,
    "yoni": 4,
    "graha_maitri": 5,
    "gana": 6,
    "bhakoot": 7,
    "nadi": 8,
}

NAKSHATRA_INDEX = {name.lower(): idx for idx, name in enumerate(NAKSHATRAS)}

VARNA_RANK = {
    "shudra": 1,
    "vaishya": 2,
    "kshatriya": 3,
    "brahmin": 4,
}

PLANET_BY_SIGN = {
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

PLANET_FRIENDS = {
    "sun": {"moon", "mars", "jupiter"},
    "moon": {"sun", "mercury"},
    "mars": {"sun", "moon", "jupiter"},
    "mercury": {"sun", "venus"},
    "jupiter": {"sun", "moon", "mars"},
    "venus": {"mercury", "saturn"},
    "saturn": {"mercury", "venus"},
}

VASHYA_COMPATIBLE = {
    frozenset({"chatushpada", "manava"}),
    frozenset({"manava", "jalachara"}),
    frozenset({"vanachara", "chatushpada"}),
}

GANA_COMPATIBLE = {
    frozenset({"deva", "manushya"}),
    frozenset({"manushya", "rakshasa"}),
}

YONI_ENEMY_PAIRS = {
    frozenset({"cat", "rat"}),
    frozenset({"dog", "cat"}),
    frozenset({"serpent", "mongoose"}),
    frozenset({"cow", "tiger"}),
}

BHAKOOT_COMPATIBLE = {
    frozenset({"dharma", "kama"}),
    frozenset({"artha", "moksha"}),
}

DEFAULT_TRAIT_SCALE_MAX = 10.0
DEFAULT_KUNDALI_MAX_SCORE = 36.0
DEFAULT_KUNDALI_WEIGHT = 80.0
DEFAULT_PERSONALITY_WEIGHT = 20.0


def _norm(value) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _as_kundali_dict(kundali: Union[KundaliProfile, Mapping[str, object]]) -> Dict[str, object]:
    if isinstance(kundali, KundaliProfile):
        chart_data = kundali.chart_data if isinstance(kundali.chart_data, dict) else {}
        rashi_lord = chart_data.get("rashi_lord")
        if not rashi_lord:
            moon_sign_key = _norm(kundali.moon_sign)
            rashi_lord = RASHI_TO_LORD.get(moon_sign_key, "")
        return {
            "moon_sign": kundali.moon_sign,
            "nakshatra": kundali.nakshatra,
            "rashi_lord": rashi_lord,
        }

    if isinstance(kundali, Mapping):
        payload = dict(kundali)
        if "rashi_lord" not in payload or not payload.get("rashi_lord"):
            moon_sign_key = _norm(payload.get("moon_sign"))
            payload["rashi_lord"] = RASHI_TO_LORD.get(moon_sign_key, "")
        return payload

    raise TypeError("kundali input must be KundaliProfile or mapping.")


def _nakshatra_idx(name: str) -> Optional[int]:
    key = _norm(name)
    if not key:
        return None
    return NAKSHATRA_INDEX.get(key)


def _score_varna(a: Dict[str, object], b: Dict[str, object]) -> int:
    a_rank = VARNA_RANK.get(_norm(a.get("varna")))
    b_rank = VARNA_RANK.get(_norm(b.get("varna")))
    if a_rank is None or b_rank is None:
        return 0
    return MAX_GUNA_POINTS["varna"] if abs(a_rank - b_rank) <= 1 else 0


def _score_vashya(a: Dict[str, object], b: Dict[str, object]) -> int:
    left = _norm(a.get("vashya"))
    right = _norm(b.get("vashya"))
    if not left or not right:
        return 0
    if left == right or frozenset({left, right}) in VASHYA_COMPATIBLE:
        return MAX_GUNA_POINTS["vashya"]
    return 0


def _score_tara(a: Dict[str, object], b: Dict[str, object]) -> int:
    left_idx = _nakshatra_idx(a.get("nakshatra"))
    right_idx = _nakshatra_idx(b.get("nakshatra"))
    if left_idx is None or right_idx is None:
        return 0

    # Simplified Tara check for MVP:
    # distance cycles in 9-step groups; even groups are treated as favorable.
    tara_group = abs(left_idx - right_idx) % 9
    if tara_group in {0, 2, 4, 6, 8}:
        return MAX_GUNA_POINTS["tara"]
    return 0


def _score_yoni(a: Dict[str, object], b: Dict[str, object]) -> int:
    left = _norm(a.get("yoni"))
    right = _norm(b.get("yoni"))
    if not left or not right:
        return 0
    if left == right:
        return MAX_GUNA_POINTS["yoni"]
    if frozenset({left, right}) in YONI_ENEMY_PAIRS:
        return 0
    return MAX_GUNA_POINTS["yoni"]


def _score_graha_maitri(a: Dict[str, object], b: Dict[str, object]) -> int:
    left_lord = PLANET_BY_SIGN.get(_norm(a.get("moon_sign")))
    right_lord = PLANET_BY_SIGN.get(_norm(b.get("moon_sign")))
    if not left_lord or not right_lord:
        return 0
    if left_lord == right_lord:
        return MAX_GUNA_POINTS["graha_maitri"]

    left_friends = PLANET_FRIENDS.get(left_lord, set())
    right_friends = PLANET_FRIENDS.get(right_lord, set())
    if right_lord in left_friends and left_lord in right_friends:
        return MAX_GUNA_POINTS["graha_maitri"]
    return 0


def _score_gana(a: Dict[str, object], b: Dict[str, object]) -> int:
    left = _norm(a.get("gana"))
    right = _norm(b.get("gana"))
    if not left or not right:
        return 0
    if left == right or frozenset({left, right}) in GANA_COMPATIBLE:
        return MAX_GUNA_POINTS["gana"]
    return 0


def _score_bhakoot(a: Dict[str, object], b: Dict[str, object]) -> int:
    left = _norm(a.get("bhakoot"))
    right = _norm(b.get("bhakoot"))
    if not left or not right:
        return 0
    if left == right or frozenset({left, right}) in BHAKOOT_COMPATIBLE:
        return MAX_GUNA_POINTS["bhakoot"]
    return 0


def _score_nadi(a: Dict[str, object], b: Dict[str, object]) -> int:
    left = _norm(a.get("nadi"))
    right = _norm(b.get("nadi"))
    if not left or not right:
        return 0
    return MAX_GUNA_POINTS["nadi"] if left != right else 0


def _coerce_trait_number(value) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_trait_dict(traits: Mapping[str, object]) -> Dict[str, float]:
    normalized: Dict[str, float] = {}
    for key, raw_value in traits.items():
        trait_name = _norm(key)
        if not trait_name:
            continue

        numeric_value = _coerce_trait_number(raw_value)
        if numeric_value is None:
            continue

        normalized[trait_name] = numeric_value

    return normalized


def _trait_similarity(value_a: float, value_b: float, scale_max: float) -> float:
    if scale_max <= 0:
        raise ValueError("scale_max must be positive.")

    difference = abs(value_a - value_b)
    normalized = max(0.0, 1.0 - (difference / scale_max))
    return normalized


def _coerce_score(value, field_name: str, minimum: float, maximum: float) -> float:
    numeric = _coerce_trait_number(value)
    if numeric is None:
        raise ValueError(f"{field_name} must be numeric.")
    if numeric < minimum or numeric > maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}.")
    return numeric


def _normalize_weight(weight, field_name: str) -> float:
    numeric = _coerce_trait_number(weight)
    if numeric is None:
        raise ValueError(f"{field_name} must be numeric.")
    if numeric < 0:
        raise ValueError(f"{field_name} cannot be negative.")
    return numeric


def _match_type(kundali_score: float, personality_score: float) -> str:
    if kundali_score > 28:
        return "High Compatibility 💞"
    if personality_score > 75:
        return "Mental Match 🧠"
    return "Balanced Match ⚖️"


def _present_number(value: float):
    return int(value) if float(value).is_integer() else round(value, 2)


def calculate_guna_match(
    kundali_a: Union[KundaliProfile, Mapping[str, object]],
    kundali_b: Union[KundaliProfile, Mapping[str, object]],
) -> Dict[str, object]:
    left = _as_kundali_dict(kundali_a)
    right = _as_kundali_dict(kundali_b)
    return calculate_ashta_koota_match(left, right)


def calculate_personality_match(
    traits_a: Mapping[str, object],
    traits_b: Mapping[str, object],
    scale_max: float = DEFAULT_TRAIT_SCALE_MAX,
) -> Dict[str, int]:
    """
    Calculate personality similarity score (0-100) from trait JSON mappings.

    Steps:
    1. Compare only shared trait keys.
    2. Compute absolute difference per trait.
    3. Convert each difference into similarity (lower diff => higher similarity).
    4. Average and convert to 0-100.
    """
    left = _as_trait_dict(traits_a)
    right = _as_trait_dict(traits_b)
    shared_traits = sorted(set(left).intersection(right))

    if not shared_traits:
        return {"personality_score": 0}

    per_trait_scores = [
        _trait_similarity(left[trait], right[trait], scale_max) for trait in shared_traits
    ]
    average_similarity = sum(per_trait_scores) / len(per_trait_scores)
    personality_score = int(round(average_similarity * 100))

    return {"personality_score": personality_score}


def calculate_personality_match_details(
    traits_a: Mapping[str, object],
    traits_b: Mapping[str, object],
    scale_max: float = DEFAULT_TRAIT_SCALE_MAX,
) -> Dict[str, object]:
    """Return per-trait similarities for admin/debugging views."""
    left = _as_trait_dict(traits_a)
    right = _as_trait_dict(traits_b)
    shared_traits = sorted(set(left).intersection(right))
    if not shared_traits:
        return {"available": False, "score": None, "traits": []}

    comparisons = [
        {
            "trait": trait,
            "user_a": left[trait],
            "user_b": right[trait],
            "similarity": round(_trait_similarity(left[trait], right[trait], scale_max) * 100, 1),
        }
        for trait in shared_traits
    ]
    return {
        "available": True,
        "score": int(round(sum(item["similarity"] for item in comparisons) / len(comparisons))),
        "traits": comparisons,
    }


def calculate_user_guna_match(user_a, user_b) -> Dict[str, object]:
    """
    Convenience wrapper to match two users by stored KundaliProfile.
    """
    try:
        kundali_a = user_a.kundali_profile
        kundali_b = user_b.kundali_profile
    except KundaliProfile.DoesNotExist as exc:
        raise ValueError("Both users must have kundali_profile before matching.") from exc

    return calculate_guna_match(kundali_a, kundali_b)


def calculate_final_match(
    kundali_score,
    personality_score,
    *,
    kundali_max_score: float = DEFAULT_KUNDALI_MAX_SCORE,
    kundali_weight: float = DEFAULT_KUNDALI_WEIGHT,
    personality_weight: float = DEFAULT_PERSONALITY_WEIGHT,
) -> Dict[str, object]:
    """
    Combine kundali + personality scores into a final weighted compatibility score.

    Formula:
        final_score =
            (kundali_score / kundali_max_score * kundali_weight)
            + (personality_score / 100 * personality_weight)
    """
    max_kundali = _normalize_weight(kundali_max_score, "kundali_max_score")
    if max_kundali == 0:
        raise ValueError("kundali_max_score must be greater than 0.")

    k_weight = _normalize_weight(kundali_weight, "kundali_weight")
    p_weight = _normalize_weight(personality_weight, "personality_weight")

    k_score = _coerce_score(kundali_score, "kundali_score", 0, max_kundali)
    p_score = _coerce_score(personality_score, "personality_score", 0, 100)

    weighted_kundali = (k_score / max_kundali) * k_weight
    weighted_personality = (p_score / 100.0) * p_weight
    final_score = weighted_kundali + weighted_personality

    return {
        "kundali_score": _present_number(k_score),
        "personality_score": _present_number(p_score),
        "final_score": int(round(final_score)),
        "match_type": _match_type(k_score, p_score),
    }


def calculate_user_personality_match(user_a, user_b, scale_max: float = DEFAULT_TRAIT_SCALE_MAX) -> Dict[str, int]:
    """
    Convenience wrapper to match two users by stored Trait JSON.
    """
    try:
        traits_a = user_a.trait_profile.traits
        traits_b = user_b.trait_profile.traits
    except Trait.DoesNotExist as exc:
        raise ValueError("Both users must have trait_profile before personality matching.") from exc

    return calculate_personality_match(traits_a or {}, traits_b or {}, scale_max=scale_max)


def calculate_user_final_match(
    user_a,
    user_b,
    *,
    scale_max: float = DEFAULT_TRAIT_SCALE_MAX,
    kundali_max_score: float = DEFAULT_KUNDALI_MAX_SCORE,
    kundali_weight: float = DEFAULT_KUNDALI_WEIGHT,
    personality_weight: float = DEFAULT_PERSONALITY_WEIGHT,
) -> Dict[str, object]:
    """
    Convenience wrapper to compute full final match for two users.
    """
    guna = calculate_user_guna_match(user_a, user_b)
    personality = calculate_user_personality_match(user_a, user_b, scale_max=scale_max)

    return calculate_final_match(
        kundali_score=guna["total_score"],
        personality_score=personality["personality_score"],
        kundali_max_score=kundali_max_score,
        kundali_weight=kundali_weight,
        personality_weight=personality_weight,
    )
