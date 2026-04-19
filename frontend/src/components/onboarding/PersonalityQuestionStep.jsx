import ProgressIndicator from "./ProgressIndicator";

export default function PersonalityQuestionStep({
  question,
  current,
  total,
  selectedOptionId,
  onSelect,
  loading,
  onBack,
}) {
  if (!question) {
    return null;
  }

  return (
    <div className="space-y-4 onboarding-step-enter">
      <ProgressIndicator current={current} label="Question" total={total} />
      <h2 className="text-lg font-semibold leading-7 text-white">{question.question_text}</h2>

      <div className="space-y-3">
        {question.options.map((option) => {
          const selected = selectedOptionId === option.id;
          return (
            <button
              className={
                selected
                  ? "w-full rounded-2xl border border-pink-300/50 bg-pink-400/20 p-4 text-left text-sm text-white shadow-lg shadow-pink-500/20"
                  : "w-full rounded-2xl border border-white/20 bg-white/5 p-4 text-left text-sm text-white transition hover:border-pink-300/40 hover:bg-pink-300/10"
              }
              disabled={loading}
              key={option.id}
              onClick={() => onSelect(option.id)}
              type="button"
            >
              {option.option_text}
            </button>
          );
        })}
      </div>

      {onBack ? (
        <button
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/35 hover:bg-white/10"
          disabled={loading}
          onClick={onBack}
          type="button"
        >
          Back
        </button>
      ) : null}
    </div>
  );
}
