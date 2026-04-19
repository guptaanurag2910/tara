import api from "./api";
import { getUser } from "./authService";

function normalizeBirthDetailsFromUser(user) {
  if (!user) {
    return null;
  }

  const hasAnyBirthValue = Boolean(user.date_of_birth || user.birth_time || user.birth_place);
  if (!hasAnyBirthValue) {
    return null;
  }

  return {
    date_of_birth: user.date_of_birth || "",
    time_of_birth: user.birth_time || "",
    place_of_birth: user.birth_place || "",
    latitude: user.latitude ? String(user.latitude) : "",
    longitude: user.longitude ? String(user.longitude) : "",
    is_default_location: Boolean(user.is_default_location),
  };
}

export async function fetchMyBirthDetails() {
  try {
    const response = await api.get("astrology/birth-details/");
    return response.data || null;
  } catch (error) {
    if (error?.status === 404) {
      const user = await getUser();
      return normalizeBirthDetailsFromUser(user);
    }
    throw error;
  }
}

export async function upsertBirthDetails(data, method = "post") {
  const payload = {
    date_of_birth: data.date_of_birth,
    place_of_birth: data.place_of_birth,
  };
  if (data.latitude !== undefined && String(data.latitude || "").trim() !== "") {
    payload.latitude = data.latitude;
  }
  if (data.longitude !== undefined && String(data.longitude || "").trim() !== "") {
    payload.longitude = data.longitude;
  }

  if (data.time_of_birth) {
    payload.time_of_birth = data.time_of_birth;
  }
  if (data.is_default_location !== undefined) {
    payload.is_default_location = Boolean(data.is_default_location);
  }

  const httpMethod = String(method || "post").toLowerCase();
  const response =
    httpMethod === "put"
      ? await api.put("astrology/birth-details/", payload)
      : await api.post("astrology/birth-details/", payload);
  return response.data;
}

export async function fetchKundali() {
  const response = await api.get("astrology/kundali/");
  return response.data;
}

export async function fetchDailyHoroscope() {
  const response = await api.get("astrology/daily-horoscope/");
  return response.data;
}

// Backward-compatible alias used by some existing components.
export async function fetchHoroscope() {
  return fetchDailyHoroscope();
}
