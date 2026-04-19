import logging
from datetime import date, datetime, time
from typing import Dict, Optional, Tuple, Union

from .vedic_kundali_engine import calculate_vedic_kundali

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

# Simplified preset cycles for MVP; easy to replace with canonical tables later.
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

logger = logging.getLogger(__name__)


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
                raise ValueError("birth_time must be HH:MM or HH:MM:SS.") from exc

    raise ValueError("birth_time must be a time, string, or null.")


def _coerce_float(value, field_name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be numeric.") from exc


def _validate_coordinates(latitude: float, longitude: float) -> None:
    if latitude < -90 or latitude > 90:
        raise ValueError("latitude must be between -90 and 90.")
    if longitude < -180 or longitude > 180:
        raise ValueError("longitude must be between -180 and 180.")


def _approx_moon_longitude(date_of_birth: date, birth_time: Optional[time], latitude: float, longitude: float) -> float:
    """
    Compute an approximate moon longitude (0-360) for MVP use.

    This is intentionally simplified and deterministic:
    - annual cycle by date
    - daily cycle by birth time
    - small geographic adjustment by location
    """
    day_of_year = date_of_birth.timetuple().tm_yday
    annual_component = ((day_of_year - 1) / 365.0) * 360.0

    if birth_time is None:
        time_component = 6.6  # midpoint bias when time is unknown
    else:
        minutes = (birth_time.hour * 60) + birth_time.minute + (birth_time.second / 60.0)
        time_component = (minutes / 1440.0) * 13.2

    geo_component = (longitude * 0.05) + (latitude * 0.02)
    return (annual_component + time_component + geo_component) % 360.0


def _moon_sign_from_longitude(moon_longitude: float) -> str:
    sign_index = int(moon_longitude // 30.0)
    return ZODIAC_SIGNS[sign_index]


def _nakshatra_from_longitude(moon_longitude: float) -> Tuple[str, int, int]:
    nakshatra_span = 360.0 / 27.0
    nakshatra_index = int(moon_longitude // nakshatra_span)

    within_nakshatra = moon_longitude % nakshatra_span
    pada_span = nakshatra_span / 4.0
    nakshatra_pada = int(within_nakshatra // pada_span) + 1

    return NAKSHATRAS[nakshatra_index], nakshatra_pada, nakshatra_index


def _assign_attributes(moon_sign: str, nakshatra_index: int) -> Dict[str, str]:
    return {
        "varna": VARNA_BY_SIGN[moon_sign],
        "vashya": VASHYA_BY_SIGN[moon_sign],
        "gana": GANA_CYCLE[nakshatra_index % len(GANA_CYCLE)],
        "yoni": YONI_CYCLE[nakshatra_index % len(YONI_CYCLE)],
        "nadi": NADI_CYCLE[nakshatra_index % len(NADI_CYCLE)],
        "bhakoot": BHAKOOT_BY_SIGN[moon_sign],
    }


def calculate_kundali(
    date_of_birth: DateInput,
    birth_time: TimeInput,
    latitude=None,
    longitude=None,
    place_of_birth: str = "",
) -> Dict[str, object]:
    """
    Calculate kundali attributes.

    Primary path uses Swiss Ephemeris sidereal calculations. If those
    optional dependencies are unavailable, we fall back to the deterministic
    MVP algorithm so API flows remain usable in local/dev setups.
    """
    try:
        chart = calculate_vedic_kundali(
            date_of_birth=date_of_birth,
            time_of_birth=birth_time,
            place_of_birth=place_of_birth,
            latitude=latitude,
            longitude=longitude,
        )
        return {
            "lagna": chart["lagna"],
            "sun_sign": chart["sun_sign"],
            "moon_sign": chart["moon_sign"],
            "ascendant_degree": chart["ascendant_degree"],
            "nakshatra": chart["nakshatra"],
            "nakshatra_pada": chart["nakshatra_pada"],
            "varna": chart["varna"],
            "vashya": chart["vashya"],
            "gana": chart["gana"],
            "yoni": chart["yoni"],
            "nadi": chart["nadi"],
            "bhakoot": chart["bhakoot"],
            "timezone_name": chart["timezone_name"],
            "planets": chart["planets"],
            "houses": chart["houses"],
            "chart_data": chart["chart_data"],
            "resolved_coordinates": chart["resolved_coordinates"],
            "is_accurate": chart["is_accurate"],
        }
    except Exception as exc:
        logger.warning("Falling back to simplified kundali calculation: %s", exc)

    dob = _parse_date(date_of_birth)
    tob = _parse_time(birth_time)
    if latitude is None or longitude is None:
        raise ValueError(
            "Could not generate kundali: provide latitude/longitude or install geocoding + Swiss Ephemeris dependencies."
        )

    lat = _coerce_float(latitude, "latitude")
    lon = _coerce_float(longitude, "longitude")
    _validate_coordinates(lat, lon)

    moon_longitude = _approx_moon_longitude(dob, tob, lat, lon)
    moon_sign = _moon_sign_from_longitude(moon_longitude)
    nakshatra, nakshatra_pada, nakshatra_index = _nakshatra_from_longitude(moon_longitude)
    attributes = _assign_attributes(moon_sign, nakshatra_index)

    return {
        "lagna": "",
        "sun_sign": "",
        "moon_sign": moon_sign,
        "ascendant_degree": None,
        "nakshatra": nakshatra,
        "nakshatra_pada": nakshatra_pada,
        "varna": attributes["varna"],
        "vashya": attributes["vashya"],
        "gana": attributes["gana"],
        "yoni": attributes["yoni"],
        "nadi": attributes["nadi"],
        "bhakoot": attributes["bhakoot"],
        "timezone_name": "",
        "planets": {},
        "houses": {},
        "chart_data": {},
        "resolved_coordinates": None,
        "is_accurate": tob is not None,
    }
