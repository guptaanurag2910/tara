const GOOGLE_MAPS_SCRIPT_ID = "tara-google-maps-script";

let mapsLoadPromise = null;

export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
}

export function isGoogleMapsReady() {
  return Boolean(window.google?.maps?.places);
}

export function loadGoogleMapsPlaces() {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is missing."));
  }

  if (isGoogleMapsReady()) {
    return Promise.resolve(window.google.maps);
  }

  if (mapsLoadPromise) {
    return mapsLoadPromise;
  }

  mapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existing) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google Maps script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps loaded without expected API objects."));
      }
    };
    script.onerror = () => reject(new Error("Could not load Google Maps script."));
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

export async function reverseGeocodeCoordinates(latitude, longitude) {
  await loadGoogleMapsPlaces();
  if (!window.google?.maps?.Geocoder) {
    return "";
  }

  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode(
      { location: { lat: Number(latitude), lng: Number(longitude) } },
      (results, status) => {
        if (status === "OK" && Array.isArray(results) && results[0]?.formatted_address) {
          resolve(results[0].formatted_address);
          return;
        }
        resolve("");
      }
    );
  });
}

export async function geocodePlaceName(placeText) {
  const query = String(placeText || "").trim();
  if (!query) {
    return null;
  }

  await loadGoogleMapsPlaces();
  if (!window.google?.maps?.Geocoder) {
    return null;
  }

  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode(
      { address: query },
      (results, status) => {
        if (status !== "OK" || !Array.isArray(results) || !results[0]?.geometry?.location) {
          resolve(null);
          return;
        }

        const latitude = results[0].geometry.location.lat?.();
        const longitude = results[0].geometry.location.lng?.();
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          resolve(null);
          return;
        }

        resolve({
          placeName: results[0].formatted_address || query,
          latitude: Number(latitude).toFixed(6),
          longitude: Number(longitude).toFixed(6),
        });
      },
    );
  });
}
