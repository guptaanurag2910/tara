import api from "./api";

export async function fetchChats() {
  const { data } = await api.get("chat/messages/");
  return data;
}

export async function sendMessage(payload) {
  const { data } = await api.post("chat/messages/", payload);
  return data;
}

export async function fetchMatchMessages(matchId) {
  const { data } = await api.get(`chat/${matchId}/messages/`);
  return data;
}

export async function sendMatchMessage(matchId, content, clientMessageId) {
  const payload = { content };
  if (clientMessageId) {
    payload.client_message_id = clientMessageId;
  }
  const { data } = await api.post(`chat/${matchId}/message/`, payload);
  return data;
}
