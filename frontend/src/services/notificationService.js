import api from "./api";

export async function fetchNotifications() {
  const { data } = await api.get("notifications/");
  return Array.isArray(data) ? data : [];
}

export async function markNotificationsRead(notificationIds) {
  const payload = {};
  if (Array.isArray(notificationIds) && notificationIds.length > 0) {
    payload.notification_ids = notificationIds;
  }
  const { data } = await api.post("notifications/read/", payload);
  return data;
}

export async function fetchNotificationPreferences() {
  const { data } = await api.get("notifications/preferences/");
  return data;
}

export async function saveNotificationPreferences(preferences) {
  const { data } = await api.patch("notifications/preferences/", preferences);
  return data;
}
