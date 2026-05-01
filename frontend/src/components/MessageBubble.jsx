import { GameMessage, GameQuestion, GameResult } from "./game";

function formatTime(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status, isRead) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "read" || isRead) {
    return "Read";
  }
  if (normalized === "delivered") {
    return "Delivered";
  }
  return "Sent";
}

export default function MessageBubble({
  message,
  isOwn,
  currentUserId = null,
  onGameAnswer,
  gameAnswers = [],
  currentUserAnswer = "",
  isAnsweringGameQuestion = false,
}) {
  const isGameEvent = String(message?.message_type || "text") === "game_event";
  const eventType = String(message?.game_payload?.event_type || "").trim().toLowerCase();
  const alignmentClass = isGameEvent ? "justify-center" : isOwn ? "justify-end" : "justify-start";

  if (isGameEvent && (eventType === "game_started" || eventType === "game_start")) {
    return (
      <div className={`flex ${alignmentClass}`}>
        <GameMessage
          gameName={message?.game_payload?.game_name || "This or That"}
          timestamp={message?.timestamp}
        />
      </div>
    );
  }

  if (isGameEvent && eventType === "game_question") {
    const questionId = Number(message?.game_payload?.question_id);
    const questionText = message?.game_payload?.question_text || message?.content || "Question";
    const options = Array.isArray(message?.game_payload?.options) ? message.game_payload.options : [];
    const hasAnswered = Boolean(String(currentUserAnswer || "").trim());

    return (
      <div className={`flex ${alignmentClass}`}>
        <div className="w-full max-w-[92%]">
          <GameQuestion
            question={questionText}
            options={options}
            disabled={isAnsweringGameQuestion || hasAnswered}
            selectedOption={currentUserAnswer}
            stepLabel={Number.isInteger(questionId) ? `Question #${questionId}` : ""}
            onAnswer={(option, optionIndex) =>
              onGameAnswer?.({
                message,
                option,
                optionIndex,
              })
            }
          />

          {Array.isArray(gameAnswers) && gameAnswers.length > 0 ? (
            <div className="mt-2 rounded-xl border border-white/15 bg-slate-900/55 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                Answers
              </p>
              <div className="mt-1 space-y-1">
                {gameAnswers.map((answer) => {
                  const isOwnAnswer = Number(answer?.sender_id) === Number(currentUserId);
                  return (
                    <p
                      key={`${answer?.sender_id}-${answer?.content}`}
                      className={`text-xs ${isOwnAnswer ? "text-rose-200" : "text-cyan-200"}`}
                    >
                      <span className="font-semibold">{isOwnAnswer ? "You" : "Them"}:</span>{" "}
                      {answer?.content}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isGameEvent && eventType === "game_result") {
    return (
      <div className={`flex ${alignmentClass}`}>
        <div className="w-full max-w-[92%]">
          <GameResult
            compact
            resultText={message?.game_payload?.result_text || message?.content || "Result updated"}
          />
        </div>
      </div>
    );
  }

  const bubbleClass = isGameEvent
    ? "rounded-2xl border border-amber-300/30 bg-amber-500/15 text-amber-50"
    : isOwn
      ? "rounded-2xl rounded-br-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white"
      : "rounded-2xl rounded-bl-sm bg-white/16 text-slate-100";

  return (
    <div className={`flex ${alignmentClass}`}>
      <div className={`max-w-[78%] px-3 py-2 text-sm shadow-md shadow-black/20 ${bubbleClass}`}>
        {isGameEvent ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            Game
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            isGameEvent
              ? "text-amber-100/80"
              : isOwn
                ? "text-rose-100/90"
                : "text-slate-300"
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isOwn ? <span>• {statusLabel(message.status, message.is_read)}</span> : null}
        </div>
      </div>
    </div>
  );
}
