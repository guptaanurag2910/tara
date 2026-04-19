import { getOnboardingProfile } from "./onboardingStorage";

const PROFILE_EXTRAS_PREFIX = "tara_profile_extras_v1";
const PROFILE_DRAFT_PREFIX = "tara_profile_edit_draft_v1";
const MAX_PHOTOS = 5;

export const INTEREST_OPTIONS = [
  "Music",
  "Travel",
  "Fitness",
  "Movies",
  "Food",
  "Books",
  "Gaming",
  "Hiking",
  "Spirituality",
  "Art",
  "Pets",
  "Startups",
];

const DEFAULT_EXTRAS = {
  photos: [],
  bio: "",
  interests: [],
};

function parseJson(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function extrasKey(userId) {
  return `${PROFILE_EXTRAS_PREFIX}:${userId || "anon"}`;
}

function draftKey(userId) {
  return `${PROFILE_DRAFT_PREFIX}:${userId || "anon"}`;
}

function normalizePhotos(rawPhotos) {
  const photos = Array.isArray(rawPhotos) ? rawPhotos : [];
  const next = photos
    .map((item, index) => {
      if (typeof item === "string" && item) {
        return {
          id: `photo-${index}-${Date.now()}`,
          src: item,
        };
      }
      if (item && typeof item === "object" && item.src) {
        return {
          id: item.id || `photo-${index}-${Date.now()}`,
          src: item.src,
        };
      }
      return null;
    })
    .filter(Boolean);

  return next.slice(0, MAX_PHOTOS);
}

export function getProfileExtras(userId) {
  const parsed = parseJson(localStorage.getItem(extrasKey(userId)), {});
  return {
    ...DEFAULT_EXTRAS,
    ...parsed,
    photos: normalizePhotos(parsed.photos),
    interests: Array.isArray(parsed.interests) ? parsed.interests : [],
  };
}

export function saveProfileExtras(userId, extras) {
  const next = {
    ...DEFAULT_EXTRAS,
    ...(extras || {}),
    photos: normalizePhotos(extras?.photos),
    interests: Array.isArray(extras?.interests) ? extras.interests : [],
  };
  localStorage.setItem(extrasKey(userId), JSON.stringify(next));
  return next;
}

export function patchProfileExtras(userId, patch) {
  const current = getProfileExtras(userId);
  return saveProfileExtras(userId, {
    ...current,
    ...(patch || {}),
  });
}

export function hydrateProfileExtrasFromOnboarding(userId) {
  const current = getProfileExtras(userId);
  if (current.photos.length > 0 || current.bio || current.interests.length > 0) {
    return current;
  }

  const onboarding = getOnboardingProfile(userId);
  return saveProfileExtras(userId, {
    photos: normalizePhotos(onboarding?.photos),
    bio: onboarding?.bio || "",
    interests: Array.isArray(onboarding?.interests) ? onboarding.interests : [],
  });
}

export function getProfileEditDraft(userId) {
  const parsed = parseJson(localStorage.getItem(draftKey(userId)), {});
  return {
    name: parsed?.name || "",
    date_of_birth: parsed?.date_of_birth || "",
    gender: parsed?.gender || "",
    preference: parsed?.preference || "",
  };
}

export function saveProfileEditDraft(userId, patch) {
  const current = getProfileEditDraft(userId);
  const next = {
    ...current,
    ...(patch || {}),
  };
  localStorage.setItem(draftKey(userId), JSON.stringify(next));
  return next;
}

export function clearProfileEditDraft(userId) {
  localStorage.removeItem(draftKey(userId));
}

export function calculateProfileCompletion({ name, date_of_birth, gender, preference, photos, bio, interests }) {
  const checks = [
    Boolean(String(name || "").trim()),
    Boolean(date_of_birth),
    Boolean(gender),
    Boolean(preference),
    Array.isArray(photos) && photos.length > 0,
    String(bio || "").trim().length >= 20,
    Array.isArray(interests) && interests.length >= 3,
  ];
  const completeCount = checks.filter(Boolean).length;
  return Math.round((completeCount / checks.length) * 100);
}

export function ageFromDob(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

export function isAdultDob(dateOfBirth) {
  const age = ageFromDob(dateOfBirth);
  return typeof age === "number" && age >= 18;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}
