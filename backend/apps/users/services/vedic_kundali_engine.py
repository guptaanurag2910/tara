from __future__ import annotations

from datetime import date, datetime, time
from typing import Dict, Mapping, Optional, Tuple, Union

DateInput = Union[date, str]
TimeInput = Optional[Union[time, str]]

ZODIAC_SIGNS = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
]

NAKSHATRAS = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashirsha",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Mula",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
]

VARNA_BY_SIGN = {
    "Aries": "Kshatriya",
    "Taurus": "Vaishya",
    "Gemini": "Shudra",
    "Cancer": "Brahmin",
    "Leo": "Kshatriya",
    "Virgo": "Vaishya",
    "Libra": "Shudra",
    "Scorpio": "Brahmin",
    "Sagittarius": "Kshatriya",
    "Capricorn": "Vaishya",
    "Aquarius": "Shudra",
    "Pisces": "Brahmin",
}

VASHYA_BY_SIGN = {
    "Aries": "Chatushpada",
    "Taurus": "Chatushpada",
    "Gemini": "Manava",
    "Cancer": "Jalachara",
    "Leo": "Vanachara",
    "Virgo": "Manava",
    "Libra": "Manava",
    "Scorpio": "Keeta",
    "Sagittarius": "Chatushpada",
    "Capricorn": "Chatushpada",
    "Aquarius": "Manava",
    "Pisces": "Jalachara",
}

BHAKOOT_BY_SIGN = {
    "Aries": "Dharma",
    "Taurus": "Artha",
    "Gemini": "Kama",
    "Cancer": "Moksha",
    "Leo": "Dharma",
    "Virgo": "Artha",
    "Libra": "Kama",
    "Scorpio": "Moksha",
    "Sagittarius": "Dharma",
    "Capricorn": "Artha",
    "Aquarius": "Kama",
    "Pisces": "Moksha",
}

GANA_CYCLE = ["Deva", "Manushya", "Rakshasa"]
NADI_CYCLE = ["Adi", "Madhya", "Antya"]
YONI_CYCLE = [
    "Horse",
    "Elephant",
    "Sheep",
    "Serpent",
    "Dog",
    "Cat",
    "Rat",
    "Cow",
    "Buffalo",
]

PLANET_IDS = {
    "Sun": "SUN",
    "Moon": "MOON",
    "Mars": "MARS",
    "Mercury": "MERCURY",
    "Jupiter": "JUPITER",
    "Venus": "VENUS",
    "Saturn": "SATURN",
    "Rahu": "MEAN_NODE",
}


def _normalize_degree(value: float) -> float:
    return float(value) % 360.0


def _parse_date(value: DateInput) -> date:
    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date_of_birth must be a valid ISO date (YYYY-MM-DD).") from exc

    raise ValueError("date_of_birth must be a date or ISO date string.")


def _parse_time(value: TimeInput) -> Optional[time]:
    if value is None or value == "":
        return None

    if isinstance(value, time):
        return value

    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError:
            try:
                return datetime.strptime(value, "%H:%M").time()
            except ValueError as exc:
                raise ValueError("time_of_birth must be HH:MM or HH:MM:SS.") from exc

    raise ValueError("time_of_birth must be a time, string, or null.")


def _coerce_float(value, field_name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be numeric.") from exc


def _validate_coordinates(latitude: float, longitude: float) -> None:
    if latitude < -90.0 or latitude > 90.0:
        raise ValueError("latitude must be between -90 and 90.")
    if longitude < -180.0 or longitude > 180.0:
        raise ValueError("longitude must be between -180 and 180.")


def _decimal_hour(value: time) -> float:
    return (
        float(value.hour)
        + (float(value.minute) / 60.0)
        + (float(value.second) / 3600.0)
        + (float(value.microsecond) / 3_600_000_000.0)
    )


def _require_swisseph():
    try:
        import swisseph as swe  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Swiss Ephemeris dependency missing. Install pyswisseph.") from exc
    return swe


def get_coordinates(place_of_birth: str) -> Tuple[float, float]:
    place = str(place_of_birth or "").strip()
    if not place:
        raise ValueError("place_of_birth is required to resolve coordinates.")

    try:
        from geopy.geocoders import Nominatim  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Geocoding dependency missing. Install geopy.") from exc

    geolocator = Nominatim(user_agent="tara-kundali-engine", timeout=10)
    location = geolocator.geocode(place, language="en")
    if location is None:
        raise ValueError(f"Could not resolve coordinates for place_of_birth='{place}'.")

    latitude = float(location.latitude)
    longitude = float(location.longitude)
    _validate_coordinates(latitude, longitude)
    return latitude, longitude


def get_timezone_name(latitude: float, longitude: float) -> str:
    _validate_coordinates(latitude, longitude)

    try:
        from timezonefinder import TimezoneFinder  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Timezone dependency missing. Install timezonefinder.") from exc

    tf = TimezoneFinder()
    zone = tf.timezone_at(lat=latitude, lng=longitude) or tf.closest_timezone_at(lat=latitude, lng=longitude)
    if not zone:
        raise ValueError("Could not detect timezone from coordinates.")
    return str(zone)


def local_to_utc(
    date_of_birth: DateInput,
    time_of_birth: TimeInput,
    timezone_name: str,
) -> datetime:
    dob = _parse_date(date_of_birth)
    tob = _parse_time(time_of_birth) or time(hour=12, minute=0)
    tz_name = str(timezone_name or "").strip()
    if not tz_name:
        raise ValueError("timezone_name is required for UTC conversion.")

    try:
        import pytz  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Timezone dependency missing. Install pytz.") from exc

    try:
        tz = pytz.timezone(tz_name)
    except Exception as exc:
        raise ValueError(f"Invalid timezone '{tz_name}'.") from exc

    naive = datetime.combine(dob, tob)
    try:
        local_dt = tz.localize(naive, is_dst=None)
    except Exception:
        # For ambiguous/non-existent local times (DST boundaries), pick the standard-safe branch.
        local_dt = tz.localize(naive, is_dst=False)

    return local_dt.astimezone(pytz.utc)


def get_julian_day(
    date_of_birth: DateInput,
    time_of_birth: TimeInput,
    latitude: float,
    longitude: float,
    *,
    timezone_name: Optional[str] = None,
) -> float:
    swe = _require_swisseph()
    lat = _coerce_float(latitude, "latitude")
    lon = _coerce_float(longitude, "longitude")
    _validate_coordinates(lat, lon)

    resolved_timezone = timezone_name or get_timezone_name(lat, lon)
    utc_dt = local_to_utc(date_of_birth, time_of_birth, resolved_timezone)
    hour_decimal = _decimal_hour(utc_dt.timetz().replace(tzinfo=None))

    jd = swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, hour_decimal)
    return float(jd)


def get_planet_positions(julian_day_ut: float) -> Dict[str, float]:
    swe = _require_swisseph()
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL

    positions: Dict[str, float] = {}
    for label, swiss_name in PLANET_IDS.items():
        planet_id = getattr(swe, swiss_name)
        values = swe.calc_ut(julian_day_ut, planet_id, flags)[0]
        positions[label] = _normalize_degree(float(values[0]))

    positions["Ketu"] = _normalize_degree(positions["Rahu"] + 180.0)
    return positions


def get_ascendant(julian_day_ut: float, latitude: float, longitude: float) -> float:
    swe = _require_swisseph()
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    lat = _coerce_float(latitude, "latitude")
    lon = _coerce_float(longitude, "longitude")
    _validate_coordinates(lat, lon)

    if hasattr(swe, "houses_ex"):
        _cusps, ascmc = swe.houses_ex(julian_day_ut, lat, lon, b"P", swe.FLG_SIDEREAL)
        return _normalize_degree(float(ascmc[0]))

    # Fallback to tropical houses + ayanamsha correction.
    _cusps, ascmc = swe.houses(julian_day_ut, lat, lon)
    ayanamsha = float(swe.get_ayanamsa_ut(julian_day_ut))
    return _normalize_degree(float(ascmc[0]) - ayanamsha)


def degree_to_sign(degree: float) -> Dict[str, Union[str, float]]:
    normalized = _normalize_degree(degree)
    sign_index = int(normalized // 30.0)
    return {
        "sign": ZODIAC_SIGNS[sign_index],
        "degree_in_sign": round(normalized % 30.0, 6),
    }


def _house_signs(lagna_sign: str) -> Dict[str, str]:
    if lagna_sign not in ZODIAC_SIGNS:
        raise ValueError(f"Invalid lagna_sign '{lagna_sign}'.")

    start = ZODIAC_SIGNS.index(lagna_sign)
    houses: Dict[str, str] = {}
    for house_num in range(1, 13):
        houses[str(house_num)] = ZODIAC_SIGNS[(start + house_num - 1) % 12]
    return houses


def build_houses(
    lagna_sign: str,
    planet_signs: Mapping[str, str],
) -> Dict[str, Dict[str, Union[str, list[str]]]]:
    house_signs = _house_signs(lagna_sign)
    houses: Dict[str, Dict[str, Union[str, list[str]]]] = {
        house_num: {"sign": sign_name, "planets": []}
        for house_num, sign_name in house_signs.items()
    }

    sign_to_house = {sign: house_num for house_num, sign in house_signs.items()}
    for planet_name, sign in planet_signs.items():
        house_num = sign_to_house.get(sign)
        if house_num is None:
            continue
        planets = houses[house_num]["planets"]
        if isinstance(planets, list):
            planets.append(planet_name)

    return houses


def _nakshatra_from_longitude(moon_longitude: float) -> Tuple[str, int, int]:
    nakshatra_span = 360.0 / 27.0
    nakshatra_index = int(_normalize_degree(moon_longitude) // nakshatra_span)
    within_nakshatra = _normalize_degree(moon_longitude) % nakshatra_span
    pada_span = nakshatra_span / 4.0
    nakshatra_pada = int(within_nakshatra // pada_span) + 1
    return NAKSHATRAS[nakshatra_index], nakshatra_pada, nakshatra_index


def _compatibility_attributes(moon_sign: str, nakshatra_index: int) -> Dict[str, str]:
    return {
        "varna": VARNA_BY_SIGN[moon_sign],
        "vashya": VASHYA_BY_SIGN[moon_sign],
        "gana": GANA_CYCLE[nakshatra_index % len(GANA_CYCLE)],
        "yoni": YONI_CYCLE[nakshatra_index % len(YONI_CYCLE)],
        "nadi": NADI_CYCLE[nakshatra_index % len(NADI_CYCLE)],
        "bhakoot": BHAKOOT_BY_SIGN[moon_sign],
    }


def calculate_vedic_kundali(
    *,
    date_of_birth: DateInput,
    time_of_birth: TimeInput,
    place_of_birth: str,
    latitude=None,
    longitude=None,
) -> Dict[str, object]:
    """
    Build a sidereal (Lahiri) Vedic chart with whole-sign houses.

    Returns a JSON-serializable payload suitable for API responses.
    """
    dob = _parse_date(date_of_birth)
    tob = _parse_time(time_of_birth)
    accurate_time = tob is not None
    effective_time = tob or time(hour=12, minute=0)

    if latitude is None or longitude is None:
        lat, lon = get_coordinates(place_of_birth)
    else:
        lat = _coerce_float(latitude, "latitude")
        lon = _coerce_float(longitude, "longitude")
        _validate_coordinates(lat, lon)

    timezone_name = get_timezone_name(lat, lon)
    jd = get_julian_day(
        dob,
        effective_time,
        lat,
        lon,
        timezone_name=timezone_name,
    )

    planet_degrees = get_planet_positions(jd)
    asc_degree = get_ascendant(jd, lat, lon)
    lagna = str(degree_to_sign(asc_degree)["sign"])

    planet_signs: Dict[str, str] = {}
    planets: Dict[str, Dict[str, Union[float, int, str]]] = {}
    for name, degree in planet_degrees.items():
        sign_payload = degree_to_sign(degree)
        sign = str(sign_payload["sign"])
        planet_signs[name] = sign
        planets[name] = {
            "degree": round(_normalize_degree(degree), 6),
            "sign": sign,
            "degree_in_sign": float(sign_payload["degree_in_sign"]),
        }

    houses = build_houses(lagna, planet_signs)
    sign_to_house = {str(payload["sign"]): int(house_num) for house_num, payload in houses.items()}
    for name, payload in planets.items():
        payload["house"] = sign_to_house[str(payload["sign"])]

    moon_sign = str(planets["Moon"]["sign"])
    sun_sign = str(planets["Sun"]["sign"])
    nakshatra, nakshatra_pada, nakshatra_index = _nakshatra_from_longitude(float(planets["Moon"]["degree"]))
    compatibility = _compatibility_attributes(moon_sign, nakshatra_index)

    chart_planets = {name.lower(): value for name, value in planets.items()}
    chart_houses = {house_num: {"sign": payload["sign"], "planets": payload["planets"]} for house_num, payload in houses.items()}

    return {
        "lagna": lagna,
        "ascendant_degree": round(asc_degree, 6),
        "sun_sign": sun_sign,
        "moon_sign": moon_sign,
        "nakshatra": nakshatra,
        "nakshatra_pada": nakshatra_pada,
        "varna": compatibility["varna"],
        "vashya": compatibility["vashya"],
        "gana": compatibility["gana"],
        "yoni": compatibility["yoni"],
        "nadi": compatibility["nadi"],
        "bhakoot": compatibility["bhakoot"],
        "timezone_name": timezone_name,
        "planets": planets,
        "houses": chart_houses,
        "chart_data": {
            "planets": chart_planets,
            "houses": chart_houses,
        },
        "resolved_coordinates": {
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
        },
        "is_accurate": accurate_time,
    }
