from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Dict, Optional, Tuple, Union

DateInput = Union[date, str]
TimeInput = Union[time, str, None]

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

PLANET_SWISS_IDS = {
    "Sun": "SUN",
    "Moon": "MOON",
    "Mars": "MARS",
    "Mercury": "MERCURY",
    "Jupiter": "JUPITER",
    "Venus": "VENUS",
    "Saturn": "SATURN",
    "Rahu": "MEAN_NODE",
}


@dataclass(frozen=True)
class Coordinates:
    latitude: float
    longitude: float


def _require_swe():
    try:
        import swisseph as swe  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Swiss Ephemeris is not installed.") from exc
    return swe


def _parse_date(value: DateInput) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date_of_birth must be YYYY-MM-DD.") from exc
    raise ValueError("date_of_birth must be a date or YYYY-MM-DD string.")


def _parse_time(value: TimeInput) -> Optional[time]:
    if value in (None, ""):
        return None
    if isinstance(value, time):
        # Normalize aware time values to naive local clock time.
        return value.replace(tzinfo=None)
    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError:
            try:
                return datetime.strptime(value, "%H:%M").time()
            except ValueError as exc:
                raise ValueError("time_of_birth must be HH:MM or HH:MM:SS.") from exc
    raise ValueError("time_of_birth must be a time value or null.")


def normalize_degree(value: float) -> float:
    return float(value) % 360.0


def degree_to_sign(degree: float) -> Dict[str, Union[str, float]]:
    normalized = normalize_degree(degree)
    sign_index = int(normalized // 30.0)
    return {
        "sign": ZODIAC_SIGNS[sign_index],
        "degree_in_sign": round(normalized % 30.0, 6),
    }


def validate_coordinates(latitude: float, longitude: float) -> None:
    if latitude < -90 or latitude > 90:
        raise ValueError("latitude must be between -90 and 90.")
    if longitude < -180 or longitude > 180:
        raise ValueError("longitude must be between -180 and 180.")


def get_coordinates(place_of_birth: str) -> Coordinates:
    place = str(place_of_birth or "").strip()
    if not place:
        raise ValueError("place_of_birth is required.")

    try:
        from geopy.geocoders import Nominatim  # type: ignore
    except ImportError as exc:
        raise RuntimeError("geopy is not installed.") from exc

    geolocator = Nominatim(user_agent="tara-astrology", timeout=10)
    location = geolocator.geocode(place)
    if location is None:
        raise ValueError(f"Could not resolve place_of_birth='{place}'.")

    latitude = float(location.latitude)
    longitude = float(location.longitude)
    validate_coordinates(latitude, longitude)
    return Coordinates(latitude=latitude, longitude=longitude)


def get_timezone_name(latitude: float, longitude: float) -> str:
    validate_coordinates(latitude, longitude)

    try:
        from timezonefinder import TimezoneFinder  # type: ignore
    except ImportError as exc:
        raise RuntimeError("timezonefinder is not installed.") from exc

    finder = TimezoneFinder()
    timezone_name = finder.timezone_at(lat=latitude, lng=longitude) or finder.closest_timezone_at(lat=latitude, lng=longitude)
    if not timezone_name:
        raise ValueError("Could not determine timezone from coordinates.")
    return str(timezone_name)


def local_to_utc(date_of_birth: DateInput, time_of_birth: TimeInput, timezone_name: str) -> datetime:
    dob = _parse_date(date_of_birth)
    tob = _parse_time(time_of_birth) or time(hour=12, minute=0)

    try:
        import pytz  # type: ignore
    except ImportError as exc:
        raise RuntimeError("pytz is not installed.") from exc

    try:
        tz = pytz.timezone(timezone_name)
    except Exception as exc:
        raise ValueError(f"Invalid timezone '{timezone_name}'.") from exc

    naive_local = datetime.combine(dob, tob)
    try:
        local_dt = tz.localize(naive_local, is_dst=None)
    except pytz.AmbiguousTimeError as exc:
        raise ValueError(
            f"Birth time {naive_local.isoformat()} is ambiguous in {timezone_name} because clocks changed. "
            "Provide the correct UTC offset or confirm the recorded time."
        ) from exc
    except pytz.NonExistentTimeError as exc:
        raise ValueError(
            f"Birth time {naive_local.isoformat()} did not occur in {timezone_name} because clocks changed."
        ) from exc

    return local_dt.astimezone(pytz.utc)


def to_decimal_hour(dt: datetime) -> float:
    t = dt.timetz().replace(tzinfo=None)
    return (
        t.hour
        + (t.minute / 60.0)
        + (t.second / 3600.0)
        + (t.microsecond / 3_600_000_000.0)
    )


def get_julian_day(date_of_birth: DateInput, time_of_birth: TimeInput, timezone_name: str) -> float:
    swe = _require_swe()
    dob = _parse_date(date_of_birth)
    tob = _parse_time(time_of_birth)
    utc_dt = local_to_utc(dob, tob, timezone_name)
    return float(swe.julday(utc_dt.year, utc_dt.month, utc_dt.day, to_decimal_hour(utc_dt)))


def get_planet_positions(jd_ut: float) -> Dict[str, float]:
    swe = _require_swe()
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL

    positions: Dict[str, float] = {}
    for label, swiss_name in PLANET_SWISS_IDS.items():
        planet_id = getattr(swe, swiss_name)
        values = swe.calc_ut(jd_ut, planet_id, flags)[0]
        positions[label] = normalize_degree(values[0])

    positions["Ketu"] = normalize_degree(positions["Rahu"] + 180.0)
    return positions


def get_ascendant(jd_ut: float, latitude: float, longitude: float) -> float:
    swe = _require_swe()
    validate_coordinates(latitude, longitude)
    swe.set_sid_mode(swe.SIDM_LAHIRI)

    if hasattr(swe, "houses_ex"):
        _cusps, ascmc = swe.houses_ex(jd_ut, latitude, longitude, b"P", swe.FLG_SIDEREAL)
        return normalize_degree(float(ascmc[0]))

    _cusps, ascmc = swe.houses(jd_ut, latitude, longitude)
    ayanamsha = float(swe.get_ayanamsa_ut(jd_ut))
    return normalize_degree(float(ascmc[0]) - ayanamsha)
