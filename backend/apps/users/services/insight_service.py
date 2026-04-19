from typing import Dict, List, Mapping, Optional

HIGH_TRAIT_THRESHOLD = 7.0
STRONG_KUNDALI_THRESHOLD = 28.0


def _norm_key(value) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _coerce_number(value) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_trait_dict(traits: Optional[Mapping[str, object]]) -> Dict[str, float]:
    if not isinstance(traits, Mapping):
        return {}

    normalized: Dict[str, float] = {}
    for key, raw_value in traits.items():
        trait_name = _norm_key(key)
        if not trait_name:
            continue

        numeric_value = _coerce_number(raw_value)
        if numeric_value is None:
            continue

        normalized[trait_name] = numeric_value

    return normalized


def _get_trait(traits: Dict[str, float], aliases: List[str]) -> Optional[float]:
    for alias in aliases:
        key = _norm_key(alias)
        if key in traits:
            return traits[key]
    return None


def _avg(values: List[Optional[float]]) -> Optional[float]:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return sum(present) / len(present)


def _estimate_stability(traits: Dict[str, float]) -> Optional[float]:
    overthinking = _get_trait(traits, ["overthinking"])
    return _avg(
        [
            _get_trait(traits, ["stability", "stable", "calmness", "calm", "emotional_regulation"]),
            _get_trait(traits, ["communication", "clarity", "patience"]),
            (10.0 - overthinking if overthinking is not None else None),
        ]
    )


def _estimate_chaos(traits: Dict[str, float]) -> Optional[float]:
    return _avg(
        [
            _get_trait(traits, ["chaos", "chaotic", "impulsiveness", "mood_swings"]),
            _get_trait(traits, ["overthinking"]),
        ]
    )


def _is_kundali_strong(kundali_data: Optional[Mapping[str, object]]) -> bool:
    if not isinstance(kundali_data, Mapping):
        return False

    for key in ("kundali_score", "total_score", "guna_score"):
        value = _coerce_number(kundali_data.get(key))
        if value is not None:
            return value >= STRONG_KUNDALI_THRESHOLD

    match_type = _norm_key(kundali_data.get("match_type"))
    if "high compatibility" in match_type:
        return True

    return False


def generate_match_insight(
    traits_a: Mapping[str, object],
    traits_b: Mapping[str, object],
    kundali_data: Optional[Mapping[str, object]] = None,
) -> str:
    """
    Generate a human-readable, rule-based relationship insight.

    Input:
    - traits_a / traits_b: trait score mappings (usually normalized on 1-10 scale)
    - kundali_data: optional mapping that may include `kundali_score` or `total_score`
    """
    user_a = _as_trait_dict(traits_a)
    user_b = _as_trait_dict(traits_b)

    a_overthinking = _get_trait(user_a, ["overthinking"])
    b_overthinking = _get_trait(user_b, ["overthinking"])
    a_emotional_depth = _get_trait(user_a, ["emotional_depth", "emotional depth"])
    b_emotional_depth = _get_trait(user_b, ["emotional_depth", "emotional depth"])

    both_high_overthinking = (
        a_overthinking is not None
        and b_overthinking is not None
        and a_overthinking >= HIGH_TRAIT_THRESHOLD
        and b_overthinking >= HIGH_TRAIT_THRESHOLD
    )
    both_emotionally_deep = (
        a_emotional_depth is not None
        and b_emotional_depth is not None
        and a_emotional_depth >= HIGH_TRAIT_THRESHOLD
        and b_emotional_depth >= HIGH_TRAIT_THRESHOLD
    )

    stability_a = _estimate_stability(user_a)
    stability_b = _estimate_stability(user_b)
    chaos_a = _estimate_chaos(user_a)
    chaos_b = _estimate_chaos(user_b)

    a_is_stable = stability_a is not None and stability_a >= HIGH_TRAIT_THRESHOLD
    b_is_stable = stability_b is not None and stability_b >= HIGH_TRAIT_THRESHOLD
    a_is_chaotic = chaos_a is not None and chaos_a >= HIGH_TRAIT_THRESHOLD
    b_is_chaotic = chaos_b is not None and chaos_b >= HIGH_TRAIT_THRESHOLD

    lines: List[str] = []

    if both_high_overthinking and both_emotionally_deep:
        lines.append(
            "You both overthink emotions and value deep connection. "
            "This creates a strong bond but may lead to overanalysis."
        )
    elif both_high_overthinking:
        lines.append(
            "You both process feelings deeply and may overthink at times. "
            "Regular reassurance can keep your connection grounded."
        )
    elif both_emotionally_deep:
        lines.append(
            "You both value emotional depth, which can create a meaningful and intimate bond."
        )

    stable_chaotic_contrast = (a_is_stable and b_is_chaotic) or (b_is_stable and a_is_chaotic)
    if stable_chaotic_contrast:
        lines.append(
            "One of you brings steadiness while the other brings intensity and spontaneity. "
            "This contrast can be powerful when communication stays clear."
        )

    if _is_kundali_strong(kundali_data):
        lines.append(
            "Your kundali alignment looks strong, suggesting natural emotional resonance and long-term harmony."
        )

    if not lines:
        lines.append(
            "Your match shows balanced potential. With honest communication and shared effort, this can grow into a strong connection."
        )

    return " ".join(lines)
