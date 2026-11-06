import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";

import api from "../services/api";

function toSixDecimals(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return parsed.toFixed(6);
}

function normalizeValue(value) {
  return {
    place_of_birth: String(value?.place_of_birth || value?.place || "").trim(),
    latitude: String(value?.latitude ?? "").trim(),
    longitude: String(value?.longitude ?? "").trim(),
    is_default_location: Boolean(value?.is_default_location),
  };
}

async function reverseLookup(lat, lon) {
  const response = await api.get("astrology/location/reverse/", {
    params: { latitude: lat, longitude: lon },
  });
  const data = response?.data || {};
  return String(data?.display_name || `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`);
}

export default function LocationInput({
  value,
  onChange,
  label = "Place of Birth",
  placeholder = "Search city or place",
  autoDetect = true,
  simple = false,
}) {
  const initial = useMemo(() => normalizeValue(value), [value]);

  const [selectedPlace, setSelectedPlace] = useState(initial.place_of_birth);
  const [latitude, setLatitude] = useState(initial.latitude);
  const [longitude, setLongitude] = useState(initial.longitude);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(initial.is_default_location);
  const [query, setQuery] = useState(initial.place_of_birth);

  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const autoDetectAttemptedRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const searchAbortRef = useRef(null);
  const inputRef = useRef(null);

  const emitChange = (next) => {
    if (typeof onChange !== "function") {
      return;
    }
    onChange({
      place_of_birth: next.place_of_birth,
      latitude: next.latitude,
      longitude: next.longitude,
      is_default_location: next.is_default_location,
    });
  };

  const updateSelection = ({ place_of_birth, latitude: lat, longitude: lon, is_default_location }) => {
    const normalized = {
      place_of_birth: String(place_of_birth || "").trim(),
      latitude: String(lat || "").trim(),
      longitude: String(lon || "").trim(),
      is_default_location: Boolean(is_default_location),
    };
    setSelectedPlace(normalized.place_of_birth);
    setLatitude(normalized.latitude);
    setLongitude(normalized.longitude);
    setIsUsingCurrentLocation(normalized.is_default_location);
    setQuery(normalized.place_of_birth);
    emitChange(normalized);
  };

  useEffect(() => {
    setSelectedPlace(initial.latitude && initial.longitude ? initial.place_of_birth : "");
    setLatitude(initial.latitude);
    setLongitude(initial.longitude);
    setIsUsingCurrentLocation(initial.is_default_location);
    setQuery(initial.place_of_birth);
  }, [initial.is_default_location, initial.latitude, initial.longitude, initial.place_of_birth]);

  const detectCurrentLocation = async () => {
    setError("");
    setInfo("");
    if (!navigator?.geolocation) {
      setError("Location is not supported in this browser. Please search manually.");
      return;
    }

    setGeoLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 120000,
        });
      });
      const lat = toSixDecimals(position.coords.latitude);
      const lon = toSixDecimals(position.coords.longitude);
      const place = await reverseLookup(lat, lon);
      updateSelection({
        place_of_birth: place,
        latitude: lat,
        longitude: lon,
        is_default_location: true,
      });
      setInfo(`Using your current location: ${place}`);
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (apiError) {
      const code = apiError?.code;
      if (code === 1) {
        setError("Location permission denied. Search and select your birth place manually.");
      } else {
        setError(apiError?.message || "Could not detect your current location.");
      }
    } finally {
      setGeoLoading(false);
    }
  };

  useEffect(() => {
    if (autoDetectAttemptedRef.current || !autoDetect) {
      return;
    }
    const hasLocation = Boolean(initial.place_of_birth && initial.latitude && initial.longitude);
    if (hasLocation) {
      return;
    }
    autoDetectAttemptedRef.current = true;
    detectCurrentLocation();
  }, [autoDetect, initial.latitude, initial.longitude, initial.place_of_birth]);

  useEffect(() => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const cleaned = String(query || "").trim();
    if (cleaned.length < 2 || cleaned === selectedPlace) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);
      try {
        const response = await api.get("astrology/location/search/", {
          params: {
            q: cleaned,
          },
          signal: controller.signal,
        });
        const data = response?.data;
        const next = Array.isArray(data)
          ? data.map((item, index) => ({
              id: `${item?.place_id || index}`,
              place_of_birth: String(item?.display_name || "").trim(),
              latitude: toSixDecimals(item?.latitude),
              longitude: toSixDecimals(item?.longitude),
            }))
          : [];
        setSuggestions(next.filter((item) => item.place_of_birth && item.latitude && item.longitude));
        setShowSuggestions(true);
      } catch (apiError) {
        const canceled =
          apiError?.raw?.code === "ERR_CANCELED" ||
          apiError?.code === "ERR_CANCELED" ||
          apiError?.name === "AbortError";
        if (!canceled) {
          setError(apiError?.message || "Could not search locations right now.");
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, [query, selectedPlace]);

  return (
    <div className={`tara-location-input space-y-2 ${simple ? "tara-location-simple" : ""}`}>
      {!simple ? <p className="text-sm font-medium tara-copy">{label}</p> : null}

      {!simple ? <div className="flex gap-2">
        <button
          type="button"
          onClick={detectCurrentLocation}
          disabled={geoLoading}
          className="tara-location-current inline-flex items-center gap-1.5 rounded-full border border-[color:var(--tara-card-border)] bg-white/5 px-3 py-2 text-xs text-[color:var(--tara-text-primary)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          Use Current Location
        </button>
      </div> : null}

      <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--tara-text-faint)]" />
        <input
          ref={inputRef}
          aria-label={label}
          autoComplete="off"
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setError("");
            setInfo("");
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (simple) {
              setSelectedPlace("");
              setLatitude("");
              setLongitude("");
              setIsUsingCurrentLocation(false);
              emitChange({
                place_of_birth: nextQuery,
                latitude: "",
                longitude: "",
                is_default_location: false,
              });
            }
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setShowSuggestions(false);
            }
            if (event.key === "Enter" && showSuggestions && suggestions.length > 0) {
              event.preventDefault();
              const first = suggestions[0];
              updateSelection({ ...first, is_default_location: false });
              setSuggestions([]);
              setShowSuggestions(false);
              setError("");
            }
          }}
          className="tara-input pl-10"
        />

        {showSuggestions && (suggestions.length > 0 || searching) ? (
          <div className="tara-location-menu absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-[color:var(--tara-card-border)] bg-[#0f0d36] p-1 shadow-2xl">
            {searching ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[color:var(--tara-text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            ) : null}
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  updateSelection({
                    place_of_birth: item.place_of_birth,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    is_default_location: false,
                  });
                  setInfo(`Selected location: ${item.place_of_birth}`);
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setError("");
                }}
                className="tara-location-suggestion flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs text-[color:var(--tara-text-primary)] hover:bg-white/10"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-[color:var(--tara-gold)]" />
                <span>{item.place_of_birth}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {simple && query ? (
        <button
          type="button"
          aria-label="Clear birthplace"
          onClick={() => {
            setQuery("");
            setSelectedPlace("");
            setLatitude("");
            setLongitude("");
            setIsUsingCurrentLocation(false);
            setSuggestions([]);
            setShowSuggestions(false);
            setError("");
            setInfo("");
            emitChange({
              place_of_birth: "",
              latitude: "",
              longitude: "",
              is_default_location: false,
            });
            inputRef.current?.focus();
          }}
          className="shrink-0 rounded-xl border border-[color:var(--tara-card-border)] p-2 text-[color:var(--tara-text-secondary)] hover:text-[color:var(--tara-text-primary)]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
      </div>

      {!simple && selectedPlace && latitude && longitude ? (
        <div className="tara-location-selected rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[color:var(--tara-text-secondary)]">
          {isUsingCurrentLocation ? (
            <p>
              Using your current location:{" "}
              <span className="text-[color:var(--tara-text-primary)]">{selectedPlace}</span>
            </p>
          ) : (
            <p>
              Selected location:{" "}
              <span className="text-[color:var(--tara-text-primary)]">{selectedPlace}</span>
            </p>
          )}
          <p className="mt-1 text-[10px] text-[color:var(--tara-text-faint)]">
            {latitude}, {longitude}
          </p>
          {isUsingCurrentLocation ? (
            <button
              type="button"
              onClick={() => {
                setIsUsingCurrentLocation(false);
                setQuery("");
                setShowSuggestions(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="mt-1 inline-flex rounded-full border border-[color:var(--tara-card-border)] px-2 py-0.5 text-[10px] text-[color:var(--tara-text-primary)]"
            >
              Change location
            </button>
          ) : null}
        </div>
      ) : null}

      {!simple && info ? <p className="tara-location-info text-xs text-emerald-200">{info}</p> : null}
      {error ? <p className="tara-location-error text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
