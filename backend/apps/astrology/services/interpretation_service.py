from __future__ import annotations

from typing import Dict, Mapping

PERSONALITY_BY_LAGNA = {
    "Aries": "You are direct, action-first, and naturally magnetic in new situations.",
    "Taurus": "You bring steadiness, loyalty, and grounded emotional presence.",
    "Gemini": "You are curious, expressive, and energized by meaningful conversation.",
    "Cancer": "You are nurturing, intuitive, and deeply values-led in relationships.",
    "Leo": "You are warm, confident, and expressive with a strong heart center.",
    "Virgo": "You are thoughtful, practical, and quietly perfection-oriented.",
    "Libra": "You are diplomatic, romantic, and skilled at emotional balance.",
    "Scorpio": "You are intense, private, and capable of profound transformation.",
    "Sagittarius": "You are optimistic, open-minded, and guided by growth.",
    "Capricorn": "You are disciplined, responsible, and long-term minded.",
    "Aquarius": "You are independent, unconventional, and future-focused.",
    "Pisces": "You are empathic, creative, and emotionally nuanced.",
}

CAREER_HINTS = {
    "Sun": "Career visibility increases when you lead with consistency.",
    "Jupiter": "Learning, mentorship, and strategic patience benefit your career path.",
    "Saturn": "Long-term discipline compounds into tangible outcomes.",
}

EMOTIONAL_HINTS_BY_MOON = {
    "Aries": "Emotions move fast; short pauses help avoid impulsive reactions.",
    "Taurus": "Your emotional security grows through routine and sensory calm.",
    "Gemini": "Talking through feelings helps you process emotional complexity.",
    "Cancer": "Protecting your energy is as important as caring for others.",
    "Leo": "You feel strongest when appreciation and authenticity are both present.",
    "Virgo": "Clarity and healthy boundaries stabilize your emotional landscape.",
    "Libra": "Harmony matters, but directness keeps relationships healthy.",
    "Scorpio": "Trust deepens slowly; vulnerability is your hidden strength.",
    "Sagittarius": "Perspective and movement help you reset emotionally.",
    "Capricorn": "You show love through reliability and practical support.",
    "Aquarius": "Space and honesty are crucial to emotional wellbeing.",
    "Pisces": "Creative expression helps channel your deep emotional sensitivity.",
}

RELATIONSHIP_HINTS_BY_VENUS_HOUSE = {
    1: "You attract through authenticity; relationships improve when you stay emotionally transparent.",
    2: "Shared values and respectful communication become your relationship anchor.",
    3: "Playful communication keeps bonds alive; avoid passive assumptions.",
    4: "You seek emotional safety in love; home energy strongly affects connection.",
    5: "Romance grows through creativity, affection, and heartfelt gestures.",
    6: "Love becomes stable through practical care and reliability.",
    7: "Partnership themes are central; clarity and reciprocity are essential.",
    8: "Deep intimacy matters; trust and vulnerability are your growth path.",
    9: "Shared beliefs and long-term vision strengthen emotional commitment.",
    10: "Public image and ambition can impact relationship balance.",
    11: "Friendship-based connection and shared goals support lasting bonds.",
    12: "Healthy boundaries protect emotional peace in close relationships.",
}

HEALTH_HINTS_BY_SATURN_HOUSE = {
    1: "Build steady routines for sleep, hydration, and movement to stay balanced.",
    6: "Consistency in daily habits can significantly improve resilience.",
    8: "Energy management matters; avoid extremes and prioritize recovery.",
    12: "Nervous system reset through rest and silence can prevent burnout.",
}


def _safe_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clamp_score(value: int, minimum: int = 1, maximum: int = 10) -> int:
    return max(minimum, min(maximum, value))


def generate_scores(kundali_payload: Mapping[str, object]) -> Dict[str, int]:
    moon_sign = str(kundali_payload.get("moon_sign") or "")
    lagna = str(kundali_payload.get("lagna") or "")
    planets = kundali_payload.get("chart_data", {}).get("planets", {}) if isinstance(kundali_payload.get("chart_data"), dict) else {}

    career = 6
    love = 6
    finance = 6

    if lagna in {"Capricorn", "Aries", "Leo", "Virgo"}:
        career += 1
    if lagna in {"Taurus", "Capricorn", "Virgo"}:
        finance += 1
    if lagna in {"Libra", "Cancer", "Pisces"}:
        love += 1

    if moon_sign in {"Cancer", "Pisces", "Libra", "Taurus"}:
        love += 1
    if moon_sign in {"Capricorn", "Virgo", "Scorpio"}:
        career += 1

    jupiter_house = _safe_int((planets.get("jupiter") or {}).get("house"), 0) if isinstance(planets, dict) else 0
    venus_house = _safe_int((planets.get("venus") or {}).get("house"), 0) if isinstance(planets, dict) else 0

    if jupiter_house in {2, 10, 11}:
        finance += 1
        career += 1
    if venus_house in {5, 7, 11}:
        love += 1

    return {
        "career": _clamp_score(career),
        "love": _clamp_score(love),
        "finance": _clamp_score(finance),
    }


def generate_insights(kundali_payload: Mapping[str, object]) -> Dict[str, str]:
    lagna = str(kundali_payload.get("lagna") or "")
    moon_sign = str(kundali_payload.get("moon_sign") or "")
    chart_data = kundali_payload.get("chart_data")
    planets = chart_data.get("planets") if isinstance(chart_data, dict) else {}

    sun_house = None
    venus_house = None
    saturn_house = None
    if isinstance(planets, dict):
        sun_house = (planets.get("sun") or {}).get("house")
        venus_house = _safe_int((planets.get("venus") or {}).get("house"), 0)
        saturn_house = _safe_int((planets.get("saturn") or {}).get("house"), 0)

    personality = PERSONALITY_BY_LAGNA.get(lagna, "You carry a unique blend of emotional and intellectual strengths.")
    emotions = EMOTIONAL_HINTS_BY_MOON.get(moon_sign, "Emotional awareness and honest communication are your growth keys.")

    career = CAREER_HINTS["Sun"]
    if sun_house in {10, 11}:
        career = "Public visibility and collaboration can accelerate your career momentum."
    elif sun_house in {6, 8}:
        career = "Complex responsibilities can become your edge when paced strategically."

    relationships = RELATIONSHIP_HINTS_BY_VENUS_HOUSE.get(
        venus_house,
        "Mutual respect and consistent communication will keep your relationships strong.",
    )
    wellbeing = HEALTH_HINTS_BY_SATURN_HOUSE.get(
        saturn_house,
        "Sustainable routines and stress boundaries are key for long-term wellbeing.",
    )
    growth = "Your next phase opens when you combine emotional honesty with disciplined action."
    if lagna in {"Scorpio", "Capricorn", "Virgo"}:
        growth = "Deep transformation is available when you trust slow, consistent progress."
    elif lagna in {"Sagittarius", "Aquarius", "Gemini"}:
        growth = "Expansion comes through learning, travel of mind, and open dialogue."

    return {
        "personality": personality,
        "career": career,
        "emotions": emotions,
        "relationships": relationships,
        "wellbeing": wellbeing,
        "growth": growth,
    }
