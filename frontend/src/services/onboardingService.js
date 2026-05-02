import api from "./api";

const FALLBACK_QUESTIONS = [
  {
    id: "fallback-1",
    question_text: "When life feels heavy, you...",
    options: [
      { id: "f1-o1", option_text: "Talk it out", trait_mapping: { communication: 3, openness: 1 } },
      { id: "f1-o2", option_text: "Take space", trait_mapping: { stability: 2, emotional_depth: 1 } },
      { id: "f1-o3", option_text: "Stay busy", trait_mapping: { overthinking: 2, chaos: 1 } },
      { id: "f1-o4", option_text: "Sit with it", trait_mapping: { emotional_depth: 2, stability: 2 } },
    ],
  },
  {
    id: "fallback-2",
    question_text: "Big decisions come from...",
    options: [
      { id: "f2-o1", option_text: "Logic", trait_mapping: { stability: 2, overthinking: 1 } },
      { id: "f2-o2", option_text: "Instinct", trait_mapping: { openness: 2, emotional_depth: 1 } },
      { id: "f2-o3", option_text: "Advice", trait_mapping: { communication: 2, stability: 1 } },
      { id: "f2-o4", option_text: "A mix", trait_mapping: { communication: 1, openness: 1, stability: 1 } },
    ],
  },
  {
    id: "fallback-3",
    question_text: "In any connection, you value...",
    options: [
      { id: "f3-o1", option_text: "Depth", trait_mapping: { emotional_depth: 3 } },
      { id: "f3-o2", option_text: "Peace", trait_mapping: { stability: 3 } },
      { id: "f3-o3", option_text: "Honesty", trait_mapping: { communication: 3 } },
      { id: "f3-o4", option_text: "Freedom", trait_mapping: { openness: 2, chaos: 1 } },
    ],
  },
  {
    id: "fallback-4",
    question_text: "Your best space feels...",
    options: [
      { id: "f4-o1", option_text: "Quiet", trait_mapping: { stability: 2, emotional_depth: 1 } },
      { id: "f4-o2", option_text: "Warm", trait_mapping: { communication: 2, openness: 1 } },
      { id: "f4-o3", option_text: "Clear", trait_mapping: { stability: 2, overthinking: 1 } },
      { id: "f4-o4", option_text: "Open", trait_mapping: { openness: 2, chaos: 1 } },
    ],
  },
  {
    id: "fallback-5",
    question_text: "Your natural rhythm is...",
    options: [
      { id: "f5-o1", option_text: "Steady", trait_mapping: { stability: 3 } },
      { id: "f5-o2", option_text: "Balanced", trait_mapping: { stability: 1, openness: 1, communication: 1 } },
      { id: "f5-o3", option_text: "Active", trait_mapping: { chaos: 2, openness: 1 } },
      { id: "f5-o4", option_text: "Flowing", trait_mapping: { chaos: 3, openness: 1 } },
    ],
  },
];

export async function saveBasicProfile(data) {
  const response = await api.post("profile/basic/", data);
  return response.data;
}

export async function saveBirthDetails(data) {
  const dateOfBirth = String(data?.date_of_birth || "").trim();
  const placeOfBirth = String(data?.place_of_birth || data?.birth_place || "").trim();
  const latitude = String(data?.latitude || "").trim();
  const longitude = String(data?.longitude || "").trim();
  const timeOfBirth = String(data?.time_of_birth || data?.birth_time || "").trim();

  const canGenerateKundali = Boolean(dateOfBirth && placeOfBirth);

  if (canGenerateKundali) {
  const payload = {
      date_of_birth: dateOfBirth,
      place_of_birth: placeOfBirth,
      is_default_location: Boolean(data?.is_default_location),
    };
    if (latitude && longitude) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }
    if (timeOfBirth) {
      payload.time_of_birth = timeOfBirth;
    }

    const response = await api.post("birth-details/", payload);
    const wrapped = response.data || {};
    const birth = wrapped.birth_details || {};
    return {
      ...birth,
      birth_place: birth.place_of_birth || placeOfBirth,
      birth_time: birth.time_of_birth || timeOfBirth || "",
      is_default_location: Boolean(
        birth.is_default_location !== undefined ? birth.is_default_location : data?.is_default_location
      ),
      kundali: wrapped.kundali || null,
    };
  }

  const legacyPayload = {
    birth_place: placeOfBirth,
    is_default_location: Boolean(data?.is_default_location),
  };
  if (latitude && longitude) {
    legacyPayload.latitude = latitude;
    legacyPayload.longitude = longitude;
  }
  if (timeOfBirth) {
    legacyPayload.birth_time = timeOfBirth;
  }
  const response = await api.post("profile/birth/", legacyPayload);
  return response.data;
}

export async function fetchQuestions() {
  try {
    const response = await api.get("personality/questions/");
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    // Fall back to local onboarding questions if backend questions are unavailable.
  }

  return FALLBACK_QUESTIONS;
}

export async function submitResponse(data) {
  const response = await api.post("personality/response/", data);
  return response.data;
}

export async function fetchProfileSummary() {
  const response = await api.get("profile/me/");
  return response.data;
}

export async function saveProfileExtras(data) {
  const payload = {};
  if (typeof data?.bio === "string") {
    payload.bio = data.bio;
  }
  if (Array.isArray(data?.interests)) {
    payload.interests = data.interests;
  }
  const response = await api.patch("profile/extras/", payload);
  return response.data;
}

export async function fetchProfilePhotos() {
  const response = await api.get("profile/photos/");
  return Array.isArray(response.data) ? response.data : [];
}

export async function uploadProfilePhoto(file) {
  if (!file) {
    throw new Error("Please choose an image to upload.");
  }
  const type = String(file.type || "").toLowerCase();
  if (type && !type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  const formData = new FormData();
  formData.append("image", file);

  // Let the browser set multipart boundary automatically.
  const response = await api.post("profile/photos/", formData, {
    headers: {
      "Content-Type": undefined,
    },
    timeout: 60000,
  });
  return response.data;
}

export async function deleteProfilePhoto(photoId) {
  await api.delete(`profile/photos/${photoId}/`);
}

export async function reorderProfilePhotos(photoIds) {
  const response = await api.post("profile/photos/reorder/", {
    photo_ids: photoIds,
  });
  return Array.isArray(response.data) ? response.data : [];
}

// Backward-compatible aliases.
export const saveBirthProfile = saveBirthDetails;
export const fetchPersonalityQuestions = fetchQuestions;
export const savePersonalityResponse = submitResponse;
