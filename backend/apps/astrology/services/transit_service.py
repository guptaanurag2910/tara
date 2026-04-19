from __future__ import annotations

from datetime import date, time
from typing import Dict

from django.utils import timezone

from .ephemeris_service import ZODIAC_SIGNS, degree_to_sign, get_julian_day, get_planet_positions


def get_daily_transits(day: date | None = None) -> Dict[str, Dict[str, object]]:
    target_day = day or timezone.now().date()
    # Fixed noon UTC for stable daily transits.
    jd_ut = get_julian_day(target_day, time(hour=12, minute=0), "UTC")
    transit_positions = get_planet_positions(jd_ut)

    transits: Dict[str, Dict[str, object]] = {}
    for name, degree in transit_positions.items():
        sign_payload = degree_to_sign(degree)
        transits[name] = {
            "degree": round(float(degree), 6),
            "sign": sign_payload["sign"],
            "degree_in_sign": sign_payload["degree_in_sign"],
        }
    return transits


def map_sign_to_house(lagna_sign: str, sign: str) -> int:
    if lagna_sign not in ZODIAC_SIGNS or sign not in ZODIAC_SIGNS:
        return 0
    lagna_index = ZODIAC_SIGNS.index(lagna_sign)
    sign_index = ZODIAC_SIGNS.index(sign)
    return ((sign_index - lagna_index) % 12) + 1


def map_transits_to_houses(lagna_sign: str, transits: Dict[str, Dict[str, object]]) -> Dict[str, Dict[str, object]]:
    mapped: Dict[str, Dict[str, object]] = {}
    for planet, payload in transits.items():
        sign = str(payload.get("sign") or "")
        mapped[planet] = {
            **payload,
            "house": map_sign_to_house(lagna_sign, sign),
        }
    return mapped
