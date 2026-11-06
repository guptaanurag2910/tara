import api from "./api";

export async function submitGameAnswer({ sessionId, questionId, selectedOption = null, textAnswer = "" }) {
  const payload = {
    session_id: sessionId,
    question_id: questionId,
  };
  if (selectedOption !== null && selectedOption !== undefined) {
    payload.selected_option = selectedOption;
  }
  if (textAnswer) {
    payload.text_answer = textAnswer;
  }
  const { data } = await api.post("games/answer/", payload);
  return data;
}

export async function uploadPhotoScavengerSubmission({ sessionId, questionId, image, caption = "" }) {
  const form = new FormData();
  form.append("question_id", String(questionId));
  form.append("image", image);
  form.append("caption", caption);
  const { data } = await api.post(`games/session/${sessionId}/photo/`, form, { timeout: 30000 });
  return data;
}

export async function fetchPhotoScavengerImage(path) {
  const apiPath = String(path || "").replace(/^\/api\//, "");
  const { data } = await api.get(apiPath, { responseType: "blob", timeout: 30000 });
  return data;
}
