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
