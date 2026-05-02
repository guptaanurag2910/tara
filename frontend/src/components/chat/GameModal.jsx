import { useEffect, useMemo, useState } from "react";

function normalizeOption(option, index) {
  if (typeof option === "string") {
    return { id: null, text: option, raw: option, key: `${option}-${index}` };
  }
  if (option && typeof option === "object") {
    const text = String(option.text || option.label || option.value || `Option ${index + 1}`);
    const optionId = Number.isInteger(option.id) ? option.id : null;
    return { id: optionId, text, raw: option, key: `${text}-${index}` };
  }
  return { id: null, text: `Option ${index + 1}`, raw: option, key: `option-${index}` };
}

export default function GameModal({
  open,
  questions = [],
  category = "",
  sessionId = null,
  onClose,
  onAnswer,
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(0);
    setSubmitting(false);
    setError("");
  }, [open, questions, sessionId]);

  const currentQuestion = questions[step] || null;
  const options = (Array.isArray(currentQuestion?.options) ? currentQuestion.options : []).map(
    normalizeOption,
  );
  const progress = useMemo(() => {
    const total = questions.length || 1;
    return Math.min(100, Math.round(((step + 1) / total) * 100));
  }, [step, questions.length]);

  if (!open) {
    return null;
  }

  async function handleOptionClick(option) {
    if (!currentQuestion || !onAnswer || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    const payload = {
      session_id: sessionId,
      question_id: currentQuestion.id,
      selected_option: option.text,
      text_answer: option.text,
    };
    if (Number.isInteger(option.id)) {
      payload.selected_option_id = option.id;
    }

    try {
      await onAnswer(payload);
      if (step >= questions.length - 1) {
        onClose?.();
      } else {
        setStep((prev) => prev + 1);
      }
    } catch (submitError) {
      setError(submitError?.message || "Could not submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        className="tara-motion-modal-enter max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-[#2f3178]/70 bg-[#121248]/94 p-5 shadow-[0_26px_80px_rgba(2,3,18,0.68)] backdrop-blur-xl"
        data-testid="game-modal"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[0.75rem] uppercase tracking-[0.35em] text-[#d7be72]">
              {String(category || "game").replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-sm text-white/45">Both answers will be shared with your match.</p>
          </div>
          <button
            className="tara-motion-pressable grid h-10 w-10 place-items-center rounded-full border border-white/15 text-lg text-white/65 transition-colors hover:text-white"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mt-4 h-[3px] w-full rounded-full bg-white/10">
            <div
              className="h-[3px] rounded-full bg-gradient-to-r from-[#d7be72] to-[#7f7cff] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/55">
            Round {Math.min(step + 1, questions.length || 1)} of {questions.length || 1}
          </p>
          <p className="mt-3 font-serif text-[1.8rem] leading-tight text-white sm:text-[2.1rem]">
            {currentQuestion?.question_text || "Question"}
          </p>

          <div className={`mt-5 grid gap-3 ${options.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {options.map((option) => (
              <button
                className="tara-motion-pressable rounded-3xl border border-[#30347d]/80 bg-[#11154b]/70 px-4 py-5 text-center font-serif text-[1.45rem] leading-tight text-white transition-all duration-200 hover:border-[#d7be72]/90 hover:bg-[#171d5f] disabled:cursor-not-allowed disabled:opacity-60 sm:text-[1.9rem] sm:leading-none"
                data-testid="game-option-button"
                disabled={submitting}
                key={option.key}
                onClick={() => handleOptionClick(option)}
                type="button"
              >
                {option.text}
              </button>
            ))}
          </div>

          {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
