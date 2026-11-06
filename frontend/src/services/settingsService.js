const USER_SETTINGS_PREFIX = "tara_user_settings_v1";
const APPEARANCE_MODE_KEY = "tara_appearance_mode_v1";

let mediaQueryCleanup = null;

export const DEFAULT_SETTINGS = {
  discovery: {
    minAge: 21,
    maxAge: 35,
    distanceKm: 40,
    genderPreference: "everyone",
  },
  notifications: {
    matches: true,
    messages: true,
    game_turns: true,
  },
  appearance: "system",
  privacy: {
    profileVisible: true,
  },
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

function settingsKey(userId) {
  return `${USER_SETTINGS_PREFIX}:${userId || "anon"}`;
}

function cleanupMediaListener() {
  if (typeof mediaQueryCleanup === "function") {
    mediaQueryCleanup();
    mediaQueryCleanup = null;
  }
}

function normalizeSettings(settings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    discovery: {
      ...DEFAULT_SETTINGS.discovery,
      ...(settings?.discovery || {}),
    },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(settings?.notifications || {}),
    },
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      ...(settings?.privacy || {}),
    },
  };

  if (settings?.notifications?.game_turns === undefined && settings?.notifications?.likes !== undefined) {
    merged.notifications.game_turns = settings.notifications.likes;
  }

  const minAge = Number(merged.discovery.minAge) || DEFAULT_SETTINGS.discovery.minAge;
  const maxAge = Number(merged.discovery.maxAge) || DEFAULT_SETTINGS.discovery.maxAge;
  merged.discovery.minAge = Math.max(18, Math.min(minAge, 70));
  merged.discovery.maxAge = Math.max(merged.discovery.minAge, Math.min(maxAge, 70));
  merged.discovery.distanceKm = Math.max(1, Math.min(Number(merged.discovery.distanceKm) || 40, 500));
  return merged;
}

function systemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveAppearance(mode) {
  if (mode === "dark" || mode === "light") {
    return mode;
  }
  return systemTheme();
}

export function applyAppearanceMode(mode) {
  const effectiveMode = mode || "system";
  const root = document.documentElement;
  cleanupMediaListener();

  if (effectiveMode === "system" && typeof window !== "undefined" && window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event) => {
      root.dataset.theme = event.matches ? "dark" : "light";
    };
    if (media.addEventListener) {
      media.addEventListener("change", listener);
      mediaQueryCleanup = () => media.removeEventListener("change", listener);
    } else {
      media.addListener(listener);
      mediaQueryCleanup = () => media.removeListener(listener);
    }
  }

  root.dataset.theme = resolveAppearance(effectiveMode);
  localStorage.setItem(APPEARANCE_MODE_KEY, effectiveMode);
}

export function initAppearanceTheme() {
  const mode = localStorage.getItem(APPEARANCE_MODE_KEY) || "system";
  applyAppearanceMode(mode);
}

export function getUserSettings(userId) {
  const parsed = parseJson(localStorage.getItem(settingsKey(userId)), DEFAULT_SETTINGS);
  return normalizeSettings(parsed);
}

export function saveUserSettings(userId, settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(settingsKey(userId), JSON.stringify(normalized));
  applyAppearanceMode(normalized.appearance);
  return normalized;
}

export function patchUserSettings(userId, patch) {
  const current = getUserSettings(userId);
  return saveUserSettings(userId, {
    ...current,
    ...(patch || {}),
    discovery: {
      ...current.discovery,
      ...(patch?.discovery || {}),
    },
    notifications: {
      ...current.notifications,
      ...(patch?.notifications || {}),
    },
    privacy: {
      ...current.privacy,
      ...(patch?.privacy || {}),
    },
  });
}

