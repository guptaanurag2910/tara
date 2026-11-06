const ONBOARDING_PROFILE_KEY = "tara_onboarding_profile_v2";

export const ONBOARDING_DEFAULTS = {
  name: "",
  date_of_birth: "",
  gender: "",
  preference: "",
  currentStep: 0,
  currentQuestionIndex: 0,
  responsesByQuestion: {},
  personalityAnswers: {},
  personalityScores: null,
  personalityTestStatus: "not_started",
  birth_place: "",
  birthPlaceConfirmed: false,
  birth_time: "",
  latitude: "",
  longitude: "",
  birthSaved: false,
  photos: [],
  bio: "",
  basicSaved: false,
  completed: false,
  completedAt: null,
};

function extractUserSeed(user) {
  if (!user || typeof user !== "object") {
    return {};
  }

  return {
    name: isGeneratedPhoneName(user) ? "" : user.name || "",
    date_of_birth: user.date_of_birth || "",
    gender: user.gender || "",
    preference: user.preference || "",
    birth_place: user.birth_place || "",
    birth_time: user.birth_time || "",
    latitude: user.latitude ? String(user.latitude) : "",
    longitude: user.longitude ? String(user.longitude) : "",
    is_default_location:
      user.is_default_location !== undefined ? Boolean(user.is_default_location) : undefined,
    photos: Array.isArray(user.photos)
      ? user.photos.map((photo) => ({
          id: photo.id,
          src: photo.image_url || photo.src || "",
        }))
      : [],
    bio: user.bio || "",
  };
}

export function isGeneratedPhoneName(user) {
  const name = String(user?.name || "").trim();
  const digits = String(user?.phone_number || "").replace(/\D/g, "");
  if (!name || digits.length < 4) {
    return false;
  }
  return name === `Tara ${digits.slice(-4)}`;
}

function normalizeOwnerUserId(userId) {
  if (userId === null || userId === undefined || userId === "") {
    return null;
  }
  const numeric = Number(userId);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return String(Math.trunc(numeric));
}

function resolveStoredProfile(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(ONBOARDING_PROFILE_KEY);
    return null;
  }
}

export function getOnboardingProfile(userId = null) {
  const ownerUserId = normalizeOwnerUserId(userId);
  const parsed = resolveStoredProfile(localStorage.getItem(ONBOARDING_PROFILE_KEY));
  if (!parsed) {
    return { ...ONBOARDING_DEFAULTS };
  }

  const storedOwner = normalizeOwnerUserId(parsed.__ownerUserId);
  if (ownerUserId && storedOwner && ownerUserId !== storedOwner) {
    return { ...ONBOARDING_DEFAULTS };
  }

  const { __ownerUserId, ...profile } = parsed;
  return { ...ONBOARDING_DEFAULTS, ...(profile || {}) };
}

export function saveOnboardingProfile(profile, userId = null) {
  const current = resolveStoredProfile(localStorage.getItem(ONBOARDING_PROFILE_KEY));
  const explicitOwner = normalizeOwnerUserId(userId);
  const currentOwner = normalizeOwnerUserId(current?.__ownerUserId);
  const nextOwner = explicitOwner || currentOwner || null;

  const next = {
    ...ONBOARDING_DEFAULTS,
    ...(profile || {}),
  };

  localStorage.setItem(
    ONBOARDING_PROFILE_KEY,
    JSON.stringify({
      ...next,
      __ownerUserId: nextOwner,
    }),
  );

  return next;
}

export function clearOnboardingProfile(userId = null) {
  const ownerUserId = normalizeOwnerUserId(userId);
  if (!ownerUserId) {
    localStorage.removeItem(ONBOARDING_PROFILE_KEY);
    return;
  }

  const current = resolveStoredProfile(localStorage.getItem(ONBOARDING_PROFILE_KEY));
  const currentOwner = normalizeOwnerUserId(current?.__ownerUserId);
  if (!currentOwner || currentOwner === ownerUserId) {
    localStorage.removeItem(ONBOARDING_PROFILE_KEY);
  }
}

export function hasOnboardingProfile(userId = null) {
  const ownerUserId = normalizeOwnerUserId(userId);
  const parsed = resolveStoredProfile(localStorage.getItem(ONBOARDING_PROFILE_KEY));
  if (!parsed) {
    return false;
  }

  const storedOwner = normalizeOwnerUserId(parsed.__ownerUserId);
  if (ownerUserId && storedOwner && ownerUserId !== storedOwner) {
    return false;
  }

  return true;
}

export function isOnboardingComplete(userId = null) {
  const profile = getOnboardingProfile(userId);
  return Boolean(profile.completed && profile.basicSaved && profile.birthSaved);
}

export function markOnboardingComplete(profile, userId = null) {
  return saveOnboardingProfile({
    ...profile,
    completed: true,
    completedAt: new Date().toISOString(),
  }, userId);
}

export function initializeOnboardingForSignup(user, userId = null) {
  const ownerUserId = userId ?? user?.id ?? null;
  const seeded = extractUserSeed(user);
  return saveOnboardingProfile(
    {
      ...seeded,
      birth_place: "",
      birthPlaceConfirmed: false,
      latitude: "",
      longitude: "",
      is_default_location: false,
      basicSaved: false,
      birthSaved: false,
      completed: false,
      completedAt: null,
    },
    ownerUserId,
  );
}

export function markOnboardingCompleteForLogin(user, userId = null) {
  const ownerUserId = userId ?? user?.id ?? null;
  const seeded = extractUserSeed(user);
  return saveOnboardingProfile(
    {
      ...seeded,
      basicSaved: true,
      birthSaved: true,
      completed: true,
      completedAt: new Date().toISOString(),
    },
    ownerUserId,
  );
}
