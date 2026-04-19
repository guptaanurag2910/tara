const TOKEN_KEY = "tara_access_token";
const REFRESH_KEY = "tara_refresh_token";
const USER_KEY = "tara_user";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setStoredAuth({ access, refresh, user }) {
  if (access) {
    localStorage.setItem(TOKEN_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
