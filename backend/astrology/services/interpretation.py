from __future__ import annotations

from typing import Dict, Mapping, Union


SIGNS = {
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
}

PERSONALITY_BY_LAGNA: Mapping[str, str] = {
    "aries": "You are direct, energetic, and usually take initiative.",
    "taurus": "You are calm, steady, and value comfort and stability.",
    "gemini": "You are curious, social, and quick to adapt.",
    "cancer": "You are caring, protective, and deeply people-focused.",
    "leo": "You are confident, warm, and naturally expressive.",
    "virgo": "You are practical, detail-oriented, and thoughtful.",
    "libra": "You are balanced, diplomatic, and relationship-oriented.",
    "scorpio": "You are intense, focused, and emotionally strong.",
    "sagittarius": "You are optimistic, adventurous, and open-minded.",
    "capricorn": "You are disciplined, ambitious, and dependable.",
    "aquarius": "You are independent, original, and future-focused.",
    "pisces": "You are empathetic, imaginative, and kind.",
}

EMOTIONS_BY_MOON_SIGN: Mapping[str, str] = {
    "aries": "You feel things quickly and prefer to clear emotions fast.",
    "taurus": "You seek emotional safety and stay steady under pressure.",
    "gemini": "You process feelings through conversation and reflection.",
    "cancer": "You feel deeply and care strongly about close bonds.",
    "leo": "You need appreciation and give your emotions wholeheartedly.",
    "virgo": "You manage feelings carefully and prefer emotional clarity.",
    "libra": "You value harmony and dislike emotional conflict.",
    "scorpio": "You feel intensely and build trust slowly but deeply.",
    "sagittarius": "You stay hopeful and recover emotionally with perspective.",
    "capricorn": "You are emotionally composed and show care through actions.",
    "aquarius": "You need emotional space and value honest communication.",
    "pisces": "You are sensitive, compassionate, and emotionally intuitive.",
}

CAREER_BY_SUN_HOUSE: Mapping[int, str] = {
    1: "You do best in careers where your personal drive and leadership are visible.",
    2: "You can grow steadily through skills that improve income and long-term security.",
    3: "Communication, sales, media, and networking can support your career growth.",
    4: "You work best in stable environments and roles with a strong support structure.",
    5: "Creative work, content, branding, and idea-led roles can suit you well.",
    6: "You can excel through consistency, discipline, and service-oriented work.",
    7: "Partnerships and client-facing roles may open important career opportunities.",
    8: "You grow when handling complex problems, research, or sensitive responsibilities.",
    9: "Teaching, mentoring, travel, and learning-based careers can be rewarding.",
    10: "Career visibility is strong; you can earn recognition through focused effort.",
    11: "Collaboration, communities, and networks can boost your career progress.",
    12: "Independent, global, or behind-the-scenes roles may suit your style.",
}


def _normalize_sign(value: str, *, field_name: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized not in SIGNS:
        raise ValueError(f"{field_name} must be one of: {', '.join(sorted(SIGNS))}.")
    return normalized


def _normalize_house(value: Union[int, str]) -> int:
    try:
        house = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("sun_house must be an integer between 1 and 12.") from exc
    if house < 1 or house > 12:
        raise ValueError("sun_house must be between 1 and 12.")
    return house


def _clamp_score(score: int) -> int:
    return max(1, min(10, score))


def _build_scores(lagna: str, moon_sign: str, sun_house: int) -> Dict[str, int]:
    career = 6
    love = 6
    finance = 6

    if lagna in {"capricorn", "aries", "leo", "virgo"}:
        career += 1
    if lagna in {"taurus", "capricorn", "virgo"}:
        finance += 1
    if lagna in {"libra", "cancer", "pisces"}:
        love += 1

    if moon_sign in {"cancer", "pisces", "libra", "taurus"}:
        love += 1
    if moon_sign in {"capricorn", "virgo", "scorpio"}:
        career += 1
    if moon_sign in {"taurus", "capricorn", "virgo"}:
        finance += 1

    if sun_house in {10, 1, 6}:
        career += 1
    if sun_house in {2, 11, 10}:
        finance += 1
    if sun_house in {5, 7, 11}:
        love += 1

    return {
        "career": _clamp_score(career),
        "love": _clamp_score(love),
        "finance": _clamp_score(finance),
    }


def generate_interpretation(lagna: str, moon_sign: str, sun_house: Union[int, str]) -> Dict[str, object]:
    """
    Build a simple, user-friendly interpretation payload.
    """
    normalized_lagna = _normalize_sign(lagna, field_name="lagna")
    normalized_moon = _normalize_sign(moon_sign, field_name="moon_sign")
    normalized_house = _normalize_house(sun_house)

    return {
        "personality": PERSONALITY_BY_LAGNA[normalized_lagna],
        "career": CAREER_BY_SUN_HOUSE[normalized_house],
        "emotions": EMOTIONS_BY_MOON_SIGN[normalized_moon],
        "scores": _build_scores(normalized_lagna, normalized_moon, normalized_house),
    }

