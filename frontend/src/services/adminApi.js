import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/";
const tokenKey = "tara_admin_access";
const adminApi = axios.create({ baseURL, timeout: 15000 });

adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(tokenKey);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      sessionStorage.removeItem(tokenKey);
      window.dispatchEvent(new Event("tara-admin-auth-expired"));
    }
    return Promise.reject(error);
  }
);

export const getAdminToken = () => sessionStorage.getItem(tokenKey);
export const setAdminToken = (token) => sessionStorage.setItem(tokenKey, token);
export const clearAdminToken = () => sessionStorage.removeItem(tokenKey);

export async function adminLogin(email, password) {
  const { data } = await adminApi.post("admin-portal/login/", { email, password });
  setAdminToken(data.access);
  return data;
}

export async function getAdminOverview() {
  return (await adminApi.get("admin-portal/overview/")).data;
}

export async function getAdminUsers({ q = "", page = 1 } = {}) {
  return (await adminApi.get("admin-portal/users/", { params: { q, page } })).data;
}

export async function getAdminRecommendations({ q = "", page = 1, status = "" } = {}) {
  return (await adminApi.get("admin-portal/recommendations/", { params: { q, page, status } })).data;
}

export async function getAdminRecommendationDetail(recommendationId) {
  return (await adminApi.get(`admin-portal/recommendations/${recommendationId}/`)).data;
}

export async function getAdminMatches({ q = "", page = 1, status = "" } = {}) {
  return (await adminApi.get("admin-portal/matches/", { params: { q, page, status } })).data;
}

export async function getAdminSwipes({ q = "", page = 1, status = "" } = {}) {
  return (await adminApi.get("admin-portal/swipes/", { params: { q, page, status } })).data;
}

export async function getAdminConversations({ q = "", page = 1 } = {}) {
  return (await adminApi.get("admin-portal/conversations/", { params: { q, page } })).data;
}

export async function getAdminGames({ q = "", page = 1 } = {}) {
  return (await adminApi.get("admin-portal/games/", { params: { q, page } })).data;
}

export async function getAdminGameNightWindows() {
  return (await adminApi.get("admin-portal/game-night/windows/")).data;
}

export async function createAdminGameNightWindow(payload) {
  return (await adminApi.post("admin-portal/game-night/windows/", payload)).data;
}

export async function updateAdminGameNightWindow(id, payload) {
  return (await adminApi.patch(`admin-portal/game-night/windows/${id}/`, payload)).data;
}

export async function deleteAdminGameNightWindow(id) {
  await adminApi.delete(`admin-portal/game-night/windows/${id}/`);
}

export async function getAdminSafetyReports(status = "") {
  return (await adminApi.get("matching/safety/moderation/queue/", { params: status ? { status } : {} })).data;
}

export async function actOnAdminSafetyReport(reportId, payload) {
  return (await adminApi.post(`matching/safety/moderation/reports/${reportId}/actions/`, payload)).data;
}

export async function getAdminSafetyAppeals(status = "") {
  return (await adminApi.get("matching/safety/moderation/appeals/", { params: status ? { status } : {} })).data;
}

export async function reviewAdminSafetyAppeal(appealId, payload) {
  return (await adminApi.post(`matching/safety/moderation/appeals/${appealId}/review/`, payload)).data;
}
