const ONBOARDING_PROFILE_KEY = "tara_onboarding_profile_v2";

export const ONBOARDING_DEFAULTS = {
  name: "",
  date_of_birth: "",
  gender: "",
  preference: "",
  birth_place: "",
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
