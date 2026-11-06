from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Dict, List, Mapping, Optional
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.utils import timezone

from .transit_service import get_daily_transits, map_transits_to_houses

FALLBACK_MOON_SIGN = {
    "Aries": {
        "career": "Take decisive action on one pending professional decision.",
        "love": "Lead with honesty instead of assumptions.",
        "finance": "Avoid impulsive spending today.",
        "overall": "Momentum is strong when you stay intentional.",
    },
    "Taurus": {
        "career": "Steady effort compounds; finish practical tasks first.",
        "love": "Comfort and reassurance deepen connection.",
        "finance": "Focus on stability and avoid risk-heavy moves.",
        "overall": "Consistency will outperform intensity.",
    },
}

DEFAULT_FALLBACK = {
    "career": "Stay focused on one meaningful priority and execute cleanly.",
    "love": "Clear communication can improve emotional alignment.",
    "finance": "Take practical decisions and avoid reactive spending.",
    "overall": "Small deliberate choices create better outcomes today.",
}

HOUSE_THEMES = {
    1: "self and personal direction",
    2: "money, speech, and values",
    3: "effort, communication, and courage",
    4: "home, comfort, and emotional roots",
    5: "creativity, romance, and intelligence",
    6: "workload, health routines, and discipline",
    7: "partnerships and one-to-one dynamics",
    8: "transformation, shared matters, and depth",
    9: "beliefs, luck, and higher learning",
    10: "career, status, and public image",
    11: "gains, networks, and long-term goals",
    12: "rest, release, and hidden patterns",
}

PLANET_MESSAGES = {
    "Sun": "highlights where your identity wants clear expression.",
    "Moon": "shows your emotional weather and what needs nurturing.",
    "Mercury": "activates planning, communication, and decision quality.",
    "Venus": "influences attraction, harmony, and pleasure.",
    "Mars": "adds momentum, ambition, and urgency.",
    "Jupiter": "supports growth, optimism, and opportunity.",
    "Saturn": "demands structure, patience, and maturity.",
    "Rahu": "pulls attention toward unconventional growth.",
    "Ketu": "asks for detachment and inner clarity.",
}


def _cache_token(value: Optional[str]) -> str:
    return str(value or "").strip().lower() or "none"


def _daily_horoscope_cache_key(
    *,
    user_id: int,
    target_day: date,
    lagna_sign: Optional[str],
    moon_sign: Optional[str],
    timezone_name: str,
) -> str:
    return (
        "astrology:daily-horoscope:"
        f"{user_id}:{target_day.isoformat()}:{_cache_token(lagna_sign)}:{_cache_token(moon_sign)}:{_cache_token(timezone_name)}"
    )


def _transit_message_for_domain(domain: str, mapped_transits: Mapping[str, Mapping[str, object]]) -> str:
    sun_house = int((mapped_transits.get("Sun") or {}).get("house") or 0)
    moon_house = int((mapped_transits.get("Moon") or {}).get("house") or 0)
    venus_house = int((mapped_transits.get("Venus") or {}).get("house") or 0)
    jupiter_house = int((mapped_transits.get("Jupiter") or {}).get("house") or 0)

    if domain == "career":
        if sun_house in {10, 11} or jupiter_house in {10, 11}:
            return "Career visibility is high; pitch ideas and take ownership of execution."
        if sun_house in {6, 8}:
            return "Operational pressure may rise; prioritize structure over speed."
        return "Progress comes through disciplined focus and clear communication."

    if domain == "love":
        if venus_house in {5, 7} or moon_house in {5, 7}:
            return "Romantic tone is supportive; initiate heartfelt conversations."
        if moon_house in {8, 12}:
            return "Emotional sensitivity is high; respond gently and avoid overreacting."
        return "Connection improves through warmth, consistency, and active listening."

    if domain == "finance":
        if jupiter_house in {2, 11}:
            return "Financial signals are constructive; favor planned long-term moves."
        if sun_house in {12}:
            return "Watch leakages and avoid avoidable expenses today."
        return "Stable budgeting and measured choices will serve you best."

    return "Balanced action across priorities keeps the day productive."


def _safe_house(mapped_transits: Mapping[str, Mapping[str, object]], planet: str) -> int:
    return int((mapped_transits.get(planet) or {}).get("house") or 0)


def _domain_detail(domain: str, mapped_transits: Mapping[str, Mapping[str, object]]) -> Dict[str, object]:
    summary = _transit_message_for_domain(domain, mapped_transits)
    sun_house = _safe_house(mapped_transits, "Sun")
    moon_house = _safe_house(mapped_transits, "Moon")
    venus_house = _safe_house(mapped_transits, "Venus")
    mars_house = _safe_house(mapped_transits, "Mars")
    jupiter_house = _safe_house(mapped_transits, "Jupiter")
    saturn_house = _safe_house(mapped_transits, "Saturn")
    mercury_house = _safe_house(mapped_transits, "Mercury")
    rahu_house = _safe_house(mapped_transits, "Rahu")

    opportunities: List[str] = []
    cautions: List[str] = []
    action = "Choose one small, concrete step and complete it fully today."

    if domain == "career":
        if sun_house in {10, 11} or jupiter_house in {10, 11}:
            opportunities.append("Visibility and recognition are available if you proactively present your work.")
        if mercury_house in {3, 10}:
            opportunities.append("Communication and documentation can create momentum on pending tasks.")
        if saturn_house in {6, 8}:
            cautions.append("Work pressure may feel heavier than usual; avoid overcommitting.")
        if mars_house in {6, 10}:
            cautions.append("Channel urgency into priorities instead of multitasking.")
        action = "Close one critical task before noon and align stakeholders with a clear update."

    elif domain == "love":
        if venus_house in {5, 7}:
            opportunities.append("Affection and connection improve through direct, warm communication.")
        if moon_house in {4, 7}:
            opportunities.append("Emotional availability can strengthen trust quickly.")
        if moon_house in {8, 12}:
            cautions.append("Sensitivity is elevated; avoid reacting to assumptions.")
        if rahu_house in {7}:
            cautions.append("Avoid idealizing new dynamics too quickly.")
        action = "Initiate one meaningful conversation and focus on listening without interruption."

    elif domain == "finance":
        if jupiter_house in {2, 11}:
            opportunities.append("Good day for planning savings, investments, or long-term financial strategy.")
        if venus_house in {2, 11}:
            opportunities.append("Supportive people and networks can open practical opportunities.")
        if sun_house in {12}:
            cautions.append("Hidden expenses can rise; track every discretionary spend.")
        if mars_house in {2, 8}:
            cautions.append("Avoid impulsive buys or emotionally driven money decisions.")
        action = "Review your top three expenses and cut one avoidable leakage today."

    else:
        if moon_house in {1, 4, 5}:
            opportunities.append("Inner clarity improves when you prioritize sleep, food, and emotional grounding.")
        if saturn_house in {6, 12}:
            cautions.append("Energy can dip under overwork; keep routines simple and sustainable.")
        action = "Protect one uninterrupted hour for recovery and reflection."

    if not opportunities:
        opportunities.append("Steady, disciplined effort is favored over dramatic moves.")
    if not cautions:
        cautions.append("Avoid rushed decisions; verify facts before committing.")

    return {
        "summary": summary,
        "opportunities": opportunities,
        "cautions": cautions,
        "action": action,
    }


def _build_key_transits(mapped_transits: Mapping[str, Mapping[str, object]]) -> List[Dict[str, object]]:
    keys = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"]
    points: List[Dict[str, object]] = []
    for planet in keys:
        payload = mapped_transits.get(planet) or {}
        house = int(payload.get("house") or 0)
        sign = str(payload.get("sign") or "")
        if house <= 0:
            continue
        points.append(
            {
                "planet": planet,
                "house": house,
                "sign": sign,
                "theme": HOUSE_THEMES.get(house, "life lessons"),
                "message": PLANET_MESSAGES.get(planet, "influences your day."),
            }
        )
    return points


def generate_daily_horoscope(*, lagna_sign: Optional[str] = None, moon_sign: Optional[str] = None, day: Optional[date] = None, timezone_name: str = "UTC") -> Dict[str, object]:
    target_day = day or timezone.now().astimezone(ZoneInfo(timezone_name)).date()

    if lagna_sign:
        transits = get_daily_transits(target_day, timezone_name)
        mapped = map_transits_to_houses(lagna_sign, transits)
        career = _transit_message_for_domain("career", mapped)
        love = _transit_message_for_domain("love", mapped)
        finance = _transit_message_for_domain("finance", mapped)
        overall = _transit_message_for_domain("overall", mapped)
        detailed = {
            "career": _domain_detail("career", mapped),
            "love": _domain_detail("love", mapped),
            "finance": _domain_detail("finance", mapped),
            "wellbeing": _domain_detail("wellbeing", mapped),
        }
        key_transits = _build_key_transits(mapped)
        return {
            "date": target_day.isoformat(),
            "timezone": timezone_name,
            "transit_snapshot": "12:00 local time",
            "source": "transit",
            "career": career,
            "love": love,
            "finance": finance,
            "overall": overall,
            "transits": mapped,
            "detailed": detailed,
            "key_transits": key_transits,
        }

    moon_key = str(moon_sign or "").strip().title()
    fallback = FALLBACK_MOON_SIGN.get(moon_key, DEFAULT_FALLBACK)
    return {
        "date": target_day.isoformat(),
        "source": "moon-sign-fallback",
        **fallback,
        "detailed": {
            "career": {
                "summary": fallback["career"],
                "opportunities": ["Focus on consistency and complete pending tasks one by one."],
                "cautions": ["Avoid scattered priorities and rushed commitments."],
                "action": "Block 45 minutes for your most important professional task.",
            },
            "love": {
                "summary": fallback["love"],
                "opportunities": ["Gentle communication can quickly improve emotional closeness."],
                "cautions": ["Do not assume intent; ask and clarify with patience."],
                "action": "Share one honest feeling with kindness and clarity.",
            },
            "finance": {
                "summary": fallback["finance"],
                "opportunities": ["Practical planning supports stable progress."],
                "cautions": ["Avoid unplanned spending triggered by mood."],
                "action": "Track all spends today and revise one budget category.",
            },
            "wellbeing": {
                "summary": "Balance your energy with routine, hydration, and quality rest.",
                "opportunities": ["A calm schedule helps emotional resilience."],
                "cautions": ["Overthinking can drain focus if breaks are skipped."],
                "action": "Take a short walk and reset your nervous system.",
            },
        },
        "key_transits": [],
    }


def get_cached_daily_horoscope(*, user_id: int, lagna_sign: Optional[str], moon_sign: Optional[str], day: Optional[date] = None, timezone_name: str = "UTC") -> Dict[str, object]:
    zone = ZoneInfo(timezone_name)
    target_day = day or timezone.now().astimezone(zone).date()
    cache_key = _daily_horoscope_cache_key(
        user_id=user_id,
        target_day=target_day,
        lagna_sign=lagna_sign,
        moon_sign=moon_sign,
        timezone_name=timezone_name,
    )
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    payload = generate_daily_horoscope(lagna_sign=lagna_sign, moon_sign=moon_sign, day=target_day, timezone_name=timezone_name)

    now = timezone.now()
    next_midnight = datetime.combine(target_day + timedelta(days=1), time.min, tzinfo=zone)
    timeout = max(60, int((next_midnight - now.astimezone(zone)).total_seconds()))
    cache.set(cache_key, payload, timeout=timeout)
    return payload
