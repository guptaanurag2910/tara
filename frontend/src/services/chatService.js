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

export async function sendMatchMessage(matchId, content, clientMessageId, replyToId) {
  const payload = { content };
  if (clientMessageId) {
    payload.client_message_id = clientMessageId;
  }
  if (replyToId) {
    payload.reply_to_id = replyToId;
  }
  const { data } = await api.post(`chat/${matchId}/message/`, payload);
  return data;
}

export async function toggleMessageReaction(matchId, messageId, emoji) {
  const { data } = await api.post(`chat/${matchId}/messages/${messageId}/reaction/`, { emoji });
  return data;
}
