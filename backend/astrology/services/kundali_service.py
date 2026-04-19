from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Dict, Mapping, Optional, Protocol, Union

DateLike = Union[date, str]
TimeLike = Union[time, str, None]

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

PLANETS = (
    "sun",
    "moon",
    "mars",
    "mercury",
    "jupiter",
    "venus",
    "saturn",
    "rahu",
    "ketu",
)


@dataclass(frozen=True)
class BirthInput:
    date_of_birth: date
    time_of_birth: time
    latitude: float
    longitude: float


class EphemerisEngine(Protocol):
    """
    Small abstraction that allows easy unit testing and future provider swaps.
    """

    def planet_longitudes(self, julian_day_ut: float) -> Dict[str, float]:
        ...

    def ascendant_longitude(self, julian_day_ut: float, latitude: float, longitude: float) -> float:
        ...


def _parse_date(value: DateLike) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError("date_of_birth must be a date or ISO date string (YYYY-MM-DD).")


def _parse_time(value: TimeLike) -> time:
    if value is None or value == "":
        return time(hour=12, minute=0, second=0)
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError:
            return datetime.strptime(value, "%H:%M").time()
    raise ValueError("time_of_birth must be a time, HH:MM string, HH:MM:SS string, or null.")


def _coerce_float(value, field_name: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be numeric.") from exc
    return result


def _validate_coordinates(latitude: float, longitude: float) -> None:
    if latitude < -90.0 or latitude > 90.0:
        raise ValueError("latitude must be between -90 and 90.")
    if longitude < -180.0 or longitude > 180.0:
        raise ValueError("longitude must be between -180 and 180.")


def _normalize_longitude(value: float) -> float:
    return value % 360.0


def _sign_index_from_longitude(value: float) -> int:
    return int(_normalize_longitude(value) // 30.0)


def sign_from_longitude(value: float) -> str:
    return ZODIAC_SIGNS[_sign_index_from_longitude(value)]


def to_julian_day(date_of_birth: DateLike, time_of_birth: TimeLike) -> float:
    """
    Gregorian calendar date/time to Julian Day (UT).
    """
    dob = _parse_date(date_of_birth)
    tob = _parse_time(time_of_birth)

    a = (14 - dob.month) // 12
    y = dob.year + 4800 - a
    m = dob.month + (12 * a) - 3

    jdn = dob.day + ((153 * m + 2) // 5) + 365 * y + (y // 4) - (y // 100) + (y // 400) - 32045
    day_fraction = ((tob.hour - 12) / 24.0) + (tob.minute / 1440.0) + ((tob.second + tob.microsecond / 1_000_000) / 86400.0)
    return float(jdn) + day_fraction


def _build_birth_input(
    date_of_birth: DateLike,
    time_of_birth: TimeLike,
    latitude,
    longitude,
) -> BirthInput:
    dob = _parse_date(date_of_birth)
    tob = _parse_time(time_of_birth)
    lat = _coerce_float(latitude, "latitude")
    lon = _coerce_float(longitude, "longitude")
    _validate_coordinates(lat, lon)
    return BirthInput(date_of_birth=dob, time_of_birth=tob, latitude=lat, longitude=lon)


class PlaceholderEphemerisEngine:
    """
    Deterministic fallback engine for local/dev/testing environments.
    """

    _orbital_speed_deg_per_day: Mapping[str, float] = {
        "sun": 0.985647,
        "moon": 13.176358,
        "mars": 0.524039,
        "mercury": 1.607,
        "jupiter": 0.083056,
        "venus": 1.174,
        "saturn": 0.0335,
        "rahu": -0.0529539,
    }

    _base_offset: Mapping[str, float] = {
        "sun": 280.0,
        "moon": 218.0,
        "mars": 20.0,
        "mercury": 60.0,
        "jupiter": 120.0,
        "venus": 300.0,
        "saturn": 240.0,
        "rahu": 180.0,
    }

    def planet_longitudes(self, julian_day_ut: float) -> Dict[str, float]:
        d = julian_day_ut - 2451545.0  # days since J2000.0
        positions: Dict[str, float] = {}
        for name, speed in self._orbital_speed_deg_per_day.items():
            base = self._base_offset[name]
            positions[name] = _normalize_longitude(base + d * speed)
        positions["ketu"] = _normalize_longitude(positions["rahu"] + 180.0)
        return positions

    def ascendant_longitude(self, julian_day_ut: float, latitude: float, longitude: float) -> float:
        # Basic local sidereal style approximation; replace with Swiss for production precision.
        gst = _normalize_longitude((julian_day_ut - 2451545.0) * 360.98564736629 + 280.46061837)
        lst = _normalize_longitude(gst + longitude)
        return lst


class SwissEphemerisEngine:
    """
    Swiss Ephemeris-backed engine. If swisseph is unavailable, use
    `get_default_ephemeris_engine()` to gracefully fall back.
    """

    def __init__(self):
        try:
            import swisseph as swe  # type: ignore
        except ImportError as exc:
            raise RuntimeError("swisseph is not installed.") from exc
        self._swe = swe

    def planet_longitudes(self, julian_day_ut: float) -> Dict[str, float]:
        swe = self._swe
        result = {
            "sun": float(swe.calc_ut(julian_day_ut, swe.SUN)[0][0]),
            "moon": float(swe.calc_ut(julian_day_ut, swe.MOON)[0][0]),
            "mars": float(swe.calc_ut(julian_day_ut, swe.MARS)[0][0]),
            "mercury": float(swe.calc_ut(julian_day_ut, swe.MERCURY)[0][0]),
            "jupiter": float(swe.calc_ut(julian_day_ut, swe.JUPITER)[0][0]),
            "venus": float(swe.calc_ut(julian_day_ut, swe.VENUS)[0][0]),
            "saturn": float(swe.calc_ut(julian_day_ut, swe.SATURN)[0][0]),
            "rahu": float(swe.calc_ut(julian_day_ut, swe.MEAN_NODE)[0][0]),
        }
        result["ketu"] = _normalize_longitude(result["rahu"] + 180.0)
        return {name: _normalize_longitude(value) for name, value in result.items()}

    def ascendant_longitude(self, julian_day_ut: float, latitude: float, longitude: float) -> float:
        swe = self._swe
        # ascmc[0] = Ascendant
        _cusps, ascmc = swe.houses(julian_day_ut, latitude, longitude, b"P")
        return _normalize_longitude(float(ascmc[0]))


def get_default_ephemeris_engine() -> EphemerisEngine:
    try:
        return SwissEphemerisEngine()
    except RuntimeError:
        return PlaceholderEphemerisEngine()


def house_from_longitude(planet_longitude: float, ascendant_longitude: float) -> int:
    relative = _normalize_longitude(planet_longitude - ascendant_longitude)
    return int(relative // 30.0) + 1


def build_houses(ascendant_longitude: float) -> Dict[str, Dict[str, float | str]]:
    houses: Dict[str, Dict[str, float | str]] = {}
    for house_num in range(1, 13):
        cusp_longitude = _normalize_longitude(ascendant_longitude + (house_num - 1) * 30.0)
        houses[str(house_num)] = {
            "cusp_longitude": round(cusp_longitude, 6),
            "sign": sign_from_longitude(cusp_longitude),
        }
    return houses


def build_planet_payload(
    planet_longitudes: Mapping[str, float],
    ascendant_longitude: float,
) -> Dict[str, Dict[str, float | int | str]]:
    planets: Dict[str, Dict[str, float | int | str]] = {}
    for planet in PLANETS:
        lon = _normalize_longitude(float(planet_longitudes[planet]))
        planets[planet] = {
            "longitude": round(lon, 6),
            "sign": sign_from_longitude(lon),
            "house": house_from_longitude(lon, ascendant_longitude),
        }
    return planets


def calculate_kundali(
    date_of_birth: DateLike,
    time_of_birth: TimeLike,
    latitude,
    longitude,
    *,
    ephemeris_engine: Optional[EphemerisEngine] = None,
) -> Dict[str, object]:
    """
    Main service entrypoint.

    Returns:
    {
      "lagna": "Cancer",
      "moon_sign": "Pisces",
      "sun_sign": "Aries",
      "planets": {...},
      "houses": {...},
    }
    """
    birth = _build_birth_input(date_of_birth, time_of_birth, latitude, longitude)
    jd = to_julian_day(birth.date_of_birth, birth.time_of_birth)
    engine = ephemeris_engine or get_default_ephemeris_engine()

    planet_longitudes = engine.planet_longitudes(jd)
    ascendant_longitude = _normalize_longitude(engine.ascendant_longitude(jd, birth.latitude, birth.longitude))

    planets = build_planet_payload(planet_longitudes, ascendant_longitude)
    houses = build_houses(ascendant_longitude)

    lagna_sign = sign_from_longitude(ascendant_longitude)
    moon_sign = sign_from_longitude(float(planet_longitudes["moon"]))
    sun_sign = sign_from_longitude(float(planet_longitudes["sun"]))

    return {
        "lagna": lagna_sign,
        "moon_sign": moon_sign,
        "sun_sign": sun_sign,
        "planets": planets,
        "houses": houses,
    }

