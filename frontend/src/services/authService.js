import api from "./api";

export async function signup(payload) {
  const { data } = await api.post("auth/signup", payload);
  return data;
}

export async function login(credentials) {
  const { data } = await api.post("auth/login", credentials);
  return data;
}

export async function getPhoneStatus(payload) {
  const { data } = await api.post("auth/phone-status", payload);
  return data;
}

export async function getUser() {
  const { data } = await api.get("auth/me");
  return data;
}

export async function resetPassword(payload) {
  const { data } = await api.post("auth/forgot-password/reset", payload);
  return data;
}

// Backward compatible names for existing imports.
export const signupUser = signup;
export const loginUser = login;
