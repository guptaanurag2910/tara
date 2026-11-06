from typing import Dict, List, Mapping, Optional

from apps.users.models import Trait

HIGH_TRAIT_THRESHOLD = 7.0


def _norm(value) -> str:
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


def _as_trait_dict(raw_traits: Optional[Mapping[str, object]]) -> Dict[str, float]:
    if not isinstance(raw_traits, Mapping):
        return {}

    normalized: Dict[str, float] = {}
    for key, raw_value in raw_traits.items():
        trait_name = _norm(key)
        if not trait_name:
            continue
        numeric_value = _coerce_number(raw_value)
        if numeric_value is None:
            continue
        normalized[trait_name] = numeric_value
    return normalized


def _get_traits(user) -> Dict[str, float]:
    try:
        traits = user.trait_profile.traits or {}
    except Trait.DoesNotExist:
        return {}
    return _as_trait_dict(traits)


def _is_high(value: Optional[float]) -> bool:
    return value is not None and value >= HIGH_TRAIT_THRESHOLD


def generate_icebreakers(match, *, limit: int = 3) -> List[str]:
    """
    Generate 2-3 rule-based conversation starters using match insight and shared traits.
    """
    user_a_traits = _get_traits(match.user_a)
    user_b_traits = _get_traits(match.user_b)
    insight = _norm(match.insight_text)

    suggestions: List[str] = []
    from apps.matching.models import GameNightSession

    game = GameNightSession.objects.filter(match=match, status=GameNightSession.Status.MATCHED).first()
    game_prompts = {
        "plot_twist": "Our story needs an ending. What happens next?",
        "split_clue": "We made a good clue-solving team. What mystery would you pick next?",
        "forbidden_word": "That word game was fun. Which clue gave it away?",
        "emoji_decode": "Our emoji round deserves a sequel. What scene should we try next?",
    }
    if game and game.game_kind in game_prompts:
        suggestions.append(game_prompts[game.game_kind])

    interests_a = {str(item).strip().lower() for item in (match.user_a.interests or []) if str(item).strip()}
    interests_b = {str(item).strip().lower() for item in (match.user_b.interests or []) if str(item).strip()}
    shared = sorted(interests_a & interests_b)
    if shared:
        suggestions.append(f"We both like {shared[0]}. What got you into it?")

    a_overthinking = user_a_traits.get("overthinking")
    b_overthinking = user_b_traits.get("overthinking")
    a_emotional_depth = user_a_traits.get("emotional_depth")
    b_emotional_depth = user_b_traits.get("emotional_depth")
    a_communication = user_a_traits.get("communication")
    b_communication = user_b_traits.get("communication")

    if _is_high(a_overthinking) and _is_high(b_overthinking):
        suggestions.append("You also overthink texts? 😄 Want to overanalyze this opener together?")

    if _is_high(a_emotional_depth) and _is_high(b_emotional_depth):
        suggestions.append("Be honest, situationships or serious?")

    if _is_high(a_communication) and _is_high(b_communication):
        suggestions.append("Rapid fire: voice notes, long texts, or late-night calls?")

    if "overanalysis" in insight or "overthink" in insight:
        suggestions.append("What is one tiny thing that instantly reassures you in a relationship?")

    if "deep connection" in insight or "emotionally deep" in insight:
        suggestions.append("What is your non-negotiable for a real emotional connection?")

    if "steady" in insight or "resonance" in insight or "harmony" in insight:
        suggestions.append("What kind of weekend feels most like 'us' to you?")

    if not suggestions:
        suggestions.extend(
            [
                "What is your green flag that people usually miss?",
                "Quick pick: mountains, beach, or city-night walks?",
                "What topic could you talk about for hours without getting bored?",
            ]
        )

    unique_suggestions = list(dict.fromkeys(suggestions))
    trimmed = unique_suggestions[: max(2, min(limit, 3))]
    if len(trimmed) < 2:
        trimmed.append("What is your favorite way to turn a regular day into a special one?")
    return trimmed
