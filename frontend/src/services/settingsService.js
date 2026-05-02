const USER_SETTINGS_PREFIX = "tara_user_settings_v1";
const APPEARANCE_MODE_KEY = "tara_appearance_mode_v1";
export const THEME_CHANGED_EVENT = "tara-theme-changed";

const THEME_TRANSITION_DURATION_MS = 420;
const THEME_COLOR_BY_MODE = {
  dark: "#0b0542",
  light: "#f8f5ff",
};

let mediaQueryCleanup = null;
let themeTransitionTimeout = null;

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
    likes: true,
  },
  appearance: "system",
  privacy: {
    profileVisible: true,
  },
};

function canUseDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

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

function cleanupThemeTransition() {
  if (themeTransitionTimeout) {
    window.clearTimeout(themeTransitionTimeout);
    themeTransitionTimeout = null;
  }
}

function normalizeAppearanceMode(mode) {
  return mode === "dark" || mode === "light" || mode === "system" ? mode : "system";
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

  const minAge = Number(merged.discovery.minAge) || DEFAULT_SETTINGS.discovery.minAge;
  const maxAge = Number(merged.discovery.maxAge) || DEFAULT_SETTINGS.discovery.maxAge;
  merged.discovery.minAge = Math.max(18, Math.min(minAge, 70));
  merged.discovery.maxAge = Math.max(merged.discovery.minAge, Math.min(maxAge, 70));
  merged.discovery.distanceKm = Math.max(1, Math.min(Number(merged.discovery.distanceKm) || 40, 500));
  merged.appearance = normalizeAppearanceMode(merged.appearance);
  return merged;
}

function systemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveAppearance(mode) {
  if (mode === "dark" || mode === "light") {
    return mode;
  }
  return systemTheme();
}

export function getStoredAppearanceMode() {
  if (!canUseDOM()) {
    return "system";
  }
  return normalizeAppearanceMode(localStorage.getItem(APPEARANCE_MODE_KEY) || "system");
}

export function hasStoredUserSettings(userId) {
  if (!canUseDOM() || !userId) {
    return false;
  }
  return Boolean(localStorage.getItem(settingsKey(userId)));
}

export function isAppearanceStorageKey(key) {
  return Boolean(
    key &&
      (key === APPEARANCE_MODE_KEY ||
        key.startsWith(`${USER_SETTINGS_PREFIX}:`)),
  );
}

export function getAppearanceModeForUser(userId, fallbackMode = getStoredAppearanceMode()) {
  if (userId && hasStoredUserSettings(userId)) {
    const settings = getUserSettings(userId);
    return normalizeAppearanceMode(settings.appearance || fallbackMode);
  }
  return normalizeAppearanceMode(fallbackMode);
}

function setThemeColorMeta(resolvedMode) {
  if (!canUseDOM()) {
    return;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", THEME_COLOR_BY_MODE[resolvedMode] || THEME_COLOR_BY_MODE.dark);
  }
}

function setDocumentTheme(preferenceMode, resolvedMode) {
  if (!canUseDOM()) {
    return;
  }
  const root = document.documentElement;
  root.dataset.appearance = normalizeAppearanceMode(preferenceMode);
  root.dataset.theme = resolvedMode;
  root.style.colorScheme = resolvedMode;
  document.body?.style?.setProperty("color-scheme", resolvedMode);
  setThemeColorMeta(resolvedMode);
}

function markThemeTransition() {
  if (!canUseDOM()) {
    return;
  }
  const root = document.documentElement;
  cleanupThemeTransition();
  root.dataset.themeChanging = "true";
  themeTransitionTimeout = window.setTimeout(() => {
    delete root.dataset.themeChanging;
    themeTransitionTimeout = null;
  }, THEME_TRANSITION_DURATION_MS);
}

function dispatchThemeChanged(mode, resolvedMode, source = "app") {
  if (!canUseDOM()) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGED_EVENT, {
      detail: {
        mode: normalizeAppearanceMode(mode),
        resolvedMode,
        source,
      },
    }),
  );
}

export function applyAppearanceMode(mode, options = {}) {
  const {
    persist = true,
    animate = true,
    source = "app",
  } = options;
  const effectiveMode = normalizeAppearanceMode(mode);

  if (!canUseDOM()) {
    return resolveAppearance(effectiveMode);
  }

  cleanupMediaListener();

  if (effectiveMode === "system" && window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event) => {
      const nextResolved = event.matches ? "dark" : "light";
      setDocumentTheme(effectiveMode, nextResolved);
      dispatchThemeChanged(effectiveMode, nextResolved, "system-change");
    };
    if (media.addEventListener) {
      media.addEventListener("change", listener);
      mediaQueryCleanup = () => media.removeEventListener("change", listener);
    } else {
      media.addListener(listener);
      mediaQueryCleanup = () => media.removeListener(listener);
    }
  }

  const resolvedMode = resolveAppearance(effectiveMode);
  if (animate) {
    markThemeTransition();
  }
  setDocumentTheme(effectiveMode, resolvedMode);

  if (persist) {
    localStorage.setItem(APPEARANCE_MODE_KEY, effectiveMode);
  }

  dispatchThemeChanged(effectiveMode, resolvedMode, source);
  return resolvedMode;
}

export function initAppearanceTheme() {
  const mode = getStoredAppearanceMode();
  applyAppearanceMode(mode, { persist: false, animate: false, source: "bootstrap" });
  return mode;
}

export function getUserSettings(userId) {
  if (!canUseDOM()) {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
  const parsed = parseJson(localStorage.getItem(settingsKey(userId)), DEFAULT_SETTINGS);
  return normalizeSettings(parsed);
}

export function saveUserSettings(userId, settings) {
  if (!canUseDOM()) {
    return normalizeSettings(settings);
  }
  const normalized = normalizeSettings(settings);
  localStorage.setItem(settingsKey(userId), JSON.stringify(normalized));
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
