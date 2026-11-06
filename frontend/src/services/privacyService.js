import api from "./api";

export async function fetchPrivacySettings() {
  return (await api.get("privacy/settings/")).data;
}

export async function savePrivacySettings(values) {
  return (await api.patch("privacy/settings/", values)).data;
}

export async function downloadAccountData() {
  const { data } = await api.get("account/export/");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tara-account-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

export async function deleteAccount() {
  await api.delete("account/", { data: { confirmation: "DELETE" } });
}

export async function fetchMyModerationActions() {
  return (await api.get("matching/safety/moderation/my-actions/")).data;
}

export async function submitModerationAppeal(actionId, statement) {
  return (await api.post(`matching/safety/appeals/${actionId}/`, { statement })).data;
}
