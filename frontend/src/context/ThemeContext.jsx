import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import {
  applyAppearanceMode,
  getAppearanceModeForUser,
  getStoredAppearanceMode,
  isAppearanceStorageKey,
  patchUserSettings,
  resolveAppearance,
  THEME_CHANGED_EVENT,
} from "../services/settingsService";

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [appearanceMode, setAppearanceModeState] = useState(() => getStoredAppearanceMode());
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveAppearance(getStoredAppearanceMode()));
  const hasHydratedUserPreference = useRef(false);

  const syncThemeState = useCallback((mode) => {
    const nextMode = mode || getStoredAppearanceMode();
    setAppearanceModeState(nextMode);
    setResolvedTheme(resolveAppearance(nextMode));
  }, []);

  useEffect(() => {
    const nextMode = getAppearanceModeForUser(user?.id, getStoredAppearanceMode());
    applyAppearanceMode(nextMode, {
      persist: true,
      animate: hasHydratedUserPreference.current,
      source: user?.id ? "auth-user" : "auth-guest",
    });
    syncThemeState(nextMode);
    hasHydratedUserPreference.current = true;
  }, [syncThemeState, user?.id]);

  useEffect(() => {
    const handleThemeChanged = (event) => {
      const mode = event?.detail?.mode || getStoredAppearanceMode();
      const resolved = event?.detail?.resolvedMode || resolveAppearance(mode);
      setAppearanceModeState(mode);
      setResolvedTheme(resolved);
    };

    const handleStorage = (event) => {
      if (event?.key && !isAppearanceStorageKey(event.key)) {
        return;
      }
      const nextMode = getAppearanceModeForUser(user?.id, getStoredAppearanceMode());
      syncThemeState(nextMode);
    };

    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncThemeState, user?.id]);

  const setAppearanceMode = useCallback(
    (mode) => {
      const nextMode = mode === "dark" || mode === "light" || mode === "system" ? mode : "system";

      if (user?.id) {
        patchUserSettings(user.id, { appearance: nextMode });
      }

      const resolved = applyAppearanceMode(nextMode, {
        persist: true,
        animate: true,
        source: "manual-toggle",
      });
      setAppearanceModeState(nextMode);
      setResolvedTheme(resolved);
      return resolved;
    },
    [user?.id],
  );

  const value = useMemo(
    () => ({
      appearanceMode,
      resolvedTheme,
      setAppearanceMode,
      isSystemTheme: appearanceMode === "system",
      isDarkTheme: resolvedTheme === "dark",
      isLightTheme: resolvedTheme === "light",
    }),
    [appearanceMode, resolvedTheme, setAppearanceMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
