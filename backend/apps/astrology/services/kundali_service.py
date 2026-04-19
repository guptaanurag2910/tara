from __future__ import annotations

from datetime import date, time
from typing import Dict, Mapping, Optional, Union

from .ephemeris_service import (
    ZODIAC_SIGNS,
    degree_to_sign,
    get_ascendant,
    get_coordinates,
    get_julian_day,
    get_planet_positions,
    get_timezone_name,
)

DateInput = Union[date, str]
TimeInput = Union[time, str, None]


def build_houses(lagna_sign: str) -> Dict[str, Dict[str, object]]:
    if lagna_sign not in ZODIAC_SIGNS:
        raise ValueError("Invalid lagna sign.")

    start = ZODIAC_SIGNS.index(lagna_sign)
    houses: Dict[str, Dict[str, object]] = {}
    for house_num in range(1, 13):
        sign = ZODIAC_SIGNS[(start + house_num - 1) % 12]
        houses[str(house_num)] = {
            "sign": sign,
            "planets": [],
        }
    return houses


def assign_planets_to_houses(
    houses: Dict[str, Dict[str, object]],
    planets: Mapping[str, Dict[str, object]],
) -> Dict[str, Dict[str, object]]:
    sign_to_house = {payload["sign"]: number for number, payload in houses.items()}
    for planet_name, payload in planets.items():
        sign = str(payload["sign"])
        house_num = sign_to_house.get(sign)
        if house_num is None:
            continue
        payload["house"] = int(house_num)
        house_planets = houses[house_num]["planets"]
        if isinstance(house_planets, list):
            house_planets.append(planet_name)
    return houses


def calculate_kundali_payload(
    *,
    date_of_birth: DateInput,
    time_of_birth: TimeInput,
    place_of_birth: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> Dict[str, object]:
    if latitude is None or longitude is None:
        coordinates = get_coordinates(place_of_birth)
        lat = coordinates.latitude
        lon = coordinates.longitude
    else:
        lat = float(latitude)
        lon = float(longitude)

    timezone_name = get_timezone_name(lat, lon)
    jd_ut = get_julian_day(date_of_birth, time_of_birth, timezone_name)
    ascendant_degree = get_ascendant(jd_ut, lat, lon)
    lagna_payload = degree_to_sign(ascendant_degree)
    lagna_sign = str(lagna_payload["sign"])

    planet_positions = get_planet_positions(jd_ut)
    planets: Dict[str, Dict[str, object]] = {}
    for planet_name, degree in planet_positions.items():
        sign_payload = degree_to_sign(degree)
        planets[planet_name] = {
            "degree": round(float(degree), 6),
            "sign": sign_payload["sign"],
            "degree_in_sign": sign_payload["degree_in_sign"],
        }

    houses = build_houses(lagna_sign)
    houses = assign_planets_to_houses(houses, planets)

    sun_sign = str(planets["Sun"]["sign"])
    moon_sign = str(planets["Moon"]["sign"])

    return {
        "lagna": lagna_sign,
        "sun_sign": sun_sign,
        "moon_sign": moon_sign,
        "timezone": timezone_name,
        "ascendant_degree": round(float(ascendant_degree), 6),
        "chart_data": {
            "ascendant_degree": round(float(ascendant_degree), 6),
            "timezone": timezone_name,
            "planets": {name.lower(): payload for name, payload in planets.items()},
            "houses": houses,
        },
        "resolved_coordinates": {
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
        },
    }
