from __future__ import annotations

import json
from typing import Dict, List
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


def _nominatim_base_url() -> str:
    return str(getattr(settings, "ASTRO_NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org")).rstrip("/")


def _headers() -> Dict[str, str]:
    return {
        "User-Agent": str(
            getattr(
                settings,
                "ASTRO_NOMINATIM_USER_AGENT",
                "TaraAstrology/1.0 (support@tara.local)",
            )
        ),
        "Accept": "application/json",
        "Accept-Language": "en",
    }


def _timeout_seconds() -> float:
    try:
        return float(getattr(settings, "ASTRO_NOMINATIM_TIMEOUT_SECONDS", 8.0))
    except (TypeError, ValueError):
        return 8.0


def _request_json(path: str, params: Dict[str, object]) -> object:
    query = urlencode({k: v for k, v in params.items() if v is not None and str(v).strip() != ""})
    url = f"{_nominatim_base_url()}/{path}?{query}"
    request = Request(url, headers=_headers())
    with urlopen(request, timeout=_timeout_seconds()) as response:  # nosec B310 - trusted upstream + fixed host
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def search_places(query: str, *, limit: int = 6) -> List[Dict[str, str]]:
    cleaned = str(query or "").strip()
    if len(cleaned) < 2:
        return []
    raw = _request_json(
        "search",
        {
            "q": cleaned,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": max(1, min(int(limit), 10)),
        },
    )
    if not isinstance(raw, list):
        return []

    places: List[Dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        display_name = str(item.get("display_name") or "").strip()
        lat = str(item.get("lat") or "").strip()
        lon = str(item.get("lon") or "").strip()
        if not display_name or not lat or not lon:
            continue
        places.append(
            {
                "display_name": display_name,
                "latitude": lat,
                "longitude": lon,
                "place_id": str(item.get("place_id") or ""),
            }
        )
    return places


def reverse_geocode(latitude: float, longitude: float) -> Dict[str, str]:
    raw = _request_json(
        "reverse",
        {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
        },
    )
    if not isinstance(raw, dict):
        return {
            "display_name": "",
            "latitude": str(latitude),
            "longitude": str(longitude),
        }

    return {
        "display_name": str(raw.get("display_name") or "").strip(),
        "latitude": str(raw.get("lat") or latitude),
        "longitude": str(raw.get("lon") or longitude),
    }

