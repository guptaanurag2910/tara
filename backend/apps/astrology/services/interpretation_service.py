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

HOUSE_THEMES = {
    1: "self-expression and personal direction",
    2: "money, speech, and values",
    3: "communication, effort, and courage",
    4: "home, comfort, and emotional roots",
    5: "romance, creativity, and joy",
    6: "work habits, service, and health routines",
    7: "partnerships and one-to-one bonds",
    8: "shared emotions, secrecy, and transformation",
    9: "beliefs, travel, and higher learning",
    10: "career, status, and public life",
    11: "friends, gains, and long-term goals",
    12: "rest, retreat, and inner healing",
}

SEVENTH_SIGN_RELATION_STYLE = {
    "Aries": "do best with partners who are direct, warm, and emotionally brave",
    "Taurus": "look for steadiness, sensuality, and dependable follow-through",
    "Gemini": "need conversation, wit, and a feeling of mental movement",
    "Cancer": "open up most when care feels safe, private, and emotionally steady",
    "Leo": "thrive with affection, loyalty, and visible appreciation",
    "Virgo": "trust partners who are thoughtful, consistent, and grounded in daily life",
    "Libra": "seek reciprocity, grace, and emotional balance",
    "Scorpio": "want depth, trust, and strong emotional honesty",
    "Sagittarius": "need freedom, truth, and shared growth",
    "Capricorn": "value reliability, maturity, and long-term intent",
    "Aquarius": "need space, friendship, and intellectual openness",
    "Pisces": "soften around partners who are empathic and spiritually open",
}


def _safe_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clamp_score(value: int, minimum: int = 1, maximum: int = 10) -> int:
    return max(minimum, min(maximum, value))


def _safe_chart_data(kundali_payload: Mapping[str, object]) -> Mapping[str, object]:
    chart_data = kundali_payload.get("chart_data")
    if isinstance(chart_data, dict):
        return chart_data
    return {}


def _safe_planets(kundali_payload: Mapping[str, object]) -> Mapping[str, Mapping[str, object]]:
    planets = _safe_chart_data(kundali_payload).get("planets")
    if isinstance(planets, dict):
        return planets
    return {}


def _planet_house(planets: Mapping[str, Mapping[str, object]], name: str) -> int:
    return _safe_int((planets.get(name) or {}).get("house"), 0)


def _planet_sign(planets: Mapping[str, Mapping[str, object]], name: str) -> str:
    return str((planets.get(name) or {}).get("sign") or "")


def _house_sign(chart_data: Mapping[str, object], house_number: int) -> str:
    houses = chart_data.get("houses")
    if not isinstance(houses, dict):
        return ""
    payload = houses.get(str(house_number)) or houses.get(house_number) or {}
    return str(payload.get("sign") or "")


def _house_theme(house_number: int) -> str:
    return HOUSE_THEMES.get(house_number, "this area of life")


def _placement_prefix(planet: str, sign: str, house: int) -> str:
    bits = [planet]
    if sign:
        bits.append(f"in {sign}")
    if house > 0:
        bits.append(f"in House {house}")
    return " ".join(bits)


def _build_personality_insight(*, lagna: str, moon_sign: str, mercury_sign: str, mercury_house: int) -> str:
    base = PERSONALITY_BY_LAGNA.get(
        lagna,
        "You carry a distinctive mix of emotional depth and practical intelligence.",
    )
    if mercury_house > 0 and mercury_sign:
        return (
            f"{base} {_placement_prefix('Mercury', mercury_sign, mercury_house)} makes your mind strongest around "
            f"{_house_theme(mercury_house)}."
        )
    if moon_sign:
        return f"{base} Your Moon in {moon_sign} adds a visible emotional tone to how people experience you."
    return base


def _build_emotional_insight(*, moon_sign: str, moon_house: int) -> str:
    base = EMOTIONAL_HINTS_BY_MOON.get(
        moon_sign,
        "Emotional awareness and honest communication are your growth keys.",
    )
    if moon_sign and moon_house > 0:
        return f"Moon in {moon_sign} in House {moon_house} puts your feelings close to {_house_theme(moon_house)}. {base}"
    if moon_sign:
        return f"Moon in {moon_sign} shapes your emotional style. {base}"
    return base


def _build_career_insight(*, sun_sign: str, sun_house: int, jupiter_sign: str, jupiter_house: int, saturn_house: int) -> str:
    if sun_house in {10, 11}:
        lead = f"{_placement_prefix('Sun', sun_sign, sun_house)} puts visibility, leadership, and public momentum high on your path."
    elif sun_house in {6, 8, 12}:
        lead = f"{_placement_prefix('Sun', sun_sign, sun_house)} favors strategic, behind-the-scenes, or high-responsibility work over constant spotlight."
    elif sun_house > 0:
        lead = f"{_placement_prefix('Sun', sun_sign, sun_house)} ties career growth to {_house_theme(sun_house)}."
    else:
        lead = CAREER_HINTS["Sun"]

    if jupiter_house in {2, 10, 11}:
        follow_up = (
            f"{_placement_prefix('Jupiter', jupiter_sign, jupiter_house)} helps you grow through learning, guidance, and long-term trust."
        )
    elif saturn_house in {6, 8, 10}:
        follow_up = f"Saturn in House {saturn_house} says results come when you structure {_house_theme(saturn_house)} patiently."
    else:
        follow_up = CAREER_HINTS["Jupiter"]
    return f"{lead} {follow_up}"


def _build_relationship_insight(
    *,
    moon_sign: str,
    venus_sign: str,
    venus_house: int,
    seventh_house_sign: str,
) -> str:
    if venus_house > 0:
        lead = (
            f"{_placement_prefix('Venus', venus_sign, venus_house)} shows that you bond through {_house_theme(venus_house)}."
        )
    else:
        lead = RELATIONSHIP_HINTS_BY_VENUS_HOUSE.get(
            venus_house,
            "Mutual respect and consistent communication will keep your relationships strong.",
        )

    if seventh_house_sign:
        follow_up = (
            f"Your 7th house in {seventh_house_sign} means you usually {SEVENTH_SIGN_RELATION_STYLE.get(seventh_house_sign, 'need clarity and reciprocity in partnership')}."
        )
    elif moon_sign:
        follow_up = f"With Moon in {moon_sign}, emotional honesty matters more to you than surface chemistry."
    else:
        follow_up = "Clarity and reciprocity matter more to you than surface chemistry."
    return f"{lead} {follow_up}"


def _build_wellbeing_insight(*, moon_sign: str, saturn_sign: str, saturn_house: int) -> str:
    lead = HEALTH_HINTS_BY_SATURN_HOUSE.get(
        saturn_house,
        f"{_placement_prefix('Saturn', saturn_sign, saturn_house)} asks for patient pacing around {_house_theme(saturn_house)}."
        if saturn_house > 0
        else "Sustainable routines and stress boundaries are key for long-term wellbeing.",
    )
    if moon_sign in {"Gemini", "Virgo", "Aquarius"}:
        follow_up = "Mental overstimulation can tire you faster than physical effort, so protect quiet time."
    elif moon_sign in {"Cancer", "Scorpio", "Pisces"}:
        follow_up = "Your body responds quickly to emotional atmosphere, so rest and emotional boundaries matter."
    else:
        follow_up = "Steady sleep, food, movement, and recovery will keep your energy from swinging too much."
    return f"{lead} {follow_up}"


def _build_growth_insight(*, lagna: str, rahu_house: int, ketu_house: int) -> str:
    if rahu_house > 0 and ketu_house > 0:
        base = (
            f"Rahu in House {rahu_house} grows you through {_house_theme(rahu_house)}, while Ketu in House {ketu_house} asks you to loosen old habits around {_house_theme(ketu_house)}."
        )
    else:
        base = "Your next phase opens when you combine emotional honesty with disciplined action."

    if lagna in {"Scorpio", "Capricorn", "Virgo"}:
        ending = "Slow progress will serve you better than forcing instant results."
    elif lagna in {"Sagittarius", "Aquarius", "Gemini"}:
        ending = "Learning, new circles, and open dialogue will unlock your next chapter."
    else:
        ending = "The more conscious you are about your patterns, the faster your chart starts working in your favor."
    return f"{base} {ending}"


def generate_scores(kundali_payload: Mapping[str, object]) -> Dict[str, int]:
    moon_sign = str(kundali_payload.get("moon_sign") or "")
    lagna = str(kundali_payload.get("lagna") or "")
    planets = _safe_planets(kundali_payload)

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
    sun_sign = str(kundali_payload.get("sun_sign") or "")
    chart_data = _safe_chart_data(kundali_payload)
    planets = _safe_planets(kundali_payload)

    sun_house = _planet_house(planets, "sun")
    mercury_sign = _planet_sign(planets, "mercury")
    mercury_house = _planet_house(planets, "mercury")
    moon_house = _planet_house(planets, "moon")
    venus_sign = _planet_sign(planets, "venus")
    venus_house = _planet_house(planets, "venus")
    jupiter_sign = _planet_sign(planets, "jupiter")
    jupiter_house = _planet_house(planets, "jupiter")
    saturn_sign = _planet_sign(planets, "saturn")
    saturn_house = _planet_house(planets, "saturn")
    rahu_house = _planet_house(planets, "rahu")
    ketu_house = _planet_house(planets, "ketu")
    seventh_house_sign = _house_sign(chart_data, 7)

    personality = _build_personality_insight(
        lagna=lagna,
        moon_sign=moon_sign,
        mercury_sign=mercury_sign,
        mercury_house=mercury_house,
    )
    emotions = _build_emotional_insight(moon_sign=moon_sign, moon_house=moon_house)
    career = _build_career_insight(
        sun_sign=sun_sign,
        sun_house=sun_house,
        jupiter_sign=jupiter_sign,
        jupiter_house=jupiter_house,
        saturn_house=saturn_house,
    )
    relationships = _build_relationship_insight(
        moon_sign=moon_sign,
        venus_sign=venus_sign,
        venus_house=venus_house,
        seventh_house_sign=seventh_house_sign,
    )
    wellbeing = _build_wellbeing_insight(
        moon_sign=moon_sign,
        saturn_sign=saturn_sign,
        saturn_house=saturn_house,
    )
    growth = _build_growth_insight(
        lagna=lagna,
        rahu_house=rahu_house,
        ketu_house=ketu_house,
    )

    return {
        "personality": personality,
        "career": career,
        "emotions": emotions,
        "relationships": relationships,
        "wellbeing": wellbeing,
        "growth": growth,
    }
