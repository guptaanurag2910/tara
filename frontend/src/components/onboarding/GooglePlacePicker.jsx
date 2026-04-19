import { useEffect, useRef, useState } from "react";

import {
  getGoogleMapsApiKey,
  isGoogleMapsReady,
  loadGoogleMapsPlaces,
} from "../../services/googleMapsService";

export default function GooglePlacePicker({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Search birthplace on Google Maps",
}) {
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onChange, onPlaceSelected]);

  useEffect(() => {
    let autocomplete = null;
    let listener = null;
    let active = true;

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      setStatusText("Set VITE_GOOGLE_MAPS_API_KEY to enable Google Maps place search.");
      return () => {
        active = false;
      };
    }

    const init = async () => {
      try {
        await loadGoogleMapsPlaces();
        if (!active || !inputRef.current || !isGoogleMapsReady()) {
          return;
        }

        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          types: ["geocode"],
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const latitude = place?.geometry?.location?.lat?.();
          const longitude = place?.geometry?.location?.lng?.();
          const placeName = place?.formatted_address || place?.name || "";

          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            onPlaceSelectedRef.current({
              placeName,
              latitude: Number(latitude).toFixed(6),
              longitude: Number(longitude).toFixed(6),
            });
          } else if (placeName) {
            onChangeRef.current({ target: { name: "birth_place", value: placeName } });
          }
        });

        setStatusText("Select a suggestion to lock exact birthplace coordinates.");
      } catch {
        if (active) {
          setStatusText("Could not load Google Maps right now. Enter birthplace and allow location, or try again.");
        }
      }
    };

    init();

    return () => {
      active = false;
      if (listener?.remove) {
        listener.remove();
      }
      if (autocomplete && window.google?.maps?.event?.clearInstanceListeners) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, []);

  return (
    <div>
      <label className="block text-sm" htmlFor="birth_place">
        <span className="mb-1.5 block font-medium tara-copy">Place of Birth</span>
        <input
          className="tara-input"
          id="birth_place"
          name="birth_place"
          onChange={onChange}
          placeholder={placeholder}
          ref={inputRef}
          type="text"
          value={value}
        />
      </label>
      {statusText ? <p className="mt-1 text-xs tara-faint">{statusText}</p> : null}
    </div>
  );
}
