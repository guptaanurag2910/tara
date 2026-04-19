import { createContext, useEffect, useMemo, useState } from "react";

import {
  getUser,
  login as loginApi,
  resetPassword as resetPasswordApi,
  signup as signupApi,
} from "../services/authService";
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
} from "../services/tokenStorage";

export const AuthContext = createContext(null);

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return `+${digits.slice(0, 15)}`;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(false);

  const fetchCurrentUser = async () => {
    const profile = await getUser();
    setUser(profile);
    setStoredAuth({ access: getStoredToken(), user: profile });
    return profile;
  };

  const login = async (credentials) => {
    const payload = {
      ...credentials,
      phone_number: normalizePhoneNumber(credentials?.phone_number),
    };
    setLoading(true);
    try {
      const response = await loginApi(payload);
      setStoredAuth(response);
      setToken(response.access);
      setUser(response.user || null);

      if (!response.user) {
        await fetchCurrentUser();
      }

      return response;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (signupPayload) => {
    const payload = {
      ...signupPayload,
      phone_number: normalizePhoneNumber(signupPayload?.phone_number),
    };
    setLoading(true);
    try {
      const response = await signupApi(payload);
      setStoredAuth(response);
      setToken(response.access);
      setUser(response.user || null);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (payload) => {
    const body = {
      ...payload,
      phone_number: normalizePhoneNumber(payload?.phone_number),
    };
    setLoading(true);
    try {
      return await resetPasswordApi(body);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token || user) {
      return;
    }

    fetchCurrentUser().catch(() => {
      logout();
    });
  }, [token, user]);

  const value = useMemo(
    () => ({ token, user, loading, login, signup, resetPassword, logout, fetchCurrentUser, setUser }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
