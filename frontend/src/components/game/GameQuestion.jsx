import { useEffect, useState } from "react";

export default function GameQuestion({
  question,
  options = [],
  onAnswer,
  stepLabel = "",
  disabled = false,
  selectedOption = null,
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), 20);
    return () => window.clearTimeout(timer);
  }, [question]);

  return (
    <section
      className={`w-full rounded-2xl border border-white/20 bg-slate-900/75 p-4 shadow-xl shadow-black/25 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Game Question</p>
      {stepLabel ? <p className="mt-1 text-xs text-slate-300">{stepLabel}</p> : null}
      <h3 className="mt-2 text-base font-semibold leading-snug text-white">{question}</h3>

      <div className="mt-4 space-y-2">
        {options.map((option, index) => {
          const optionValue =
            typeof option === "object" && option !== null
              ? option.id ?? option.value ?? index
              : index;
          const label =
            typeof option === "object" && option !== null ? option.label ?? option.option_text ?? "" : option;
          const isSelected =
            String(selectedOption) === String(optionValue) ||
            String(selectedOption) === String(label);

          return (
            <button
              key={`${optionValue}-${label}`}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer?.(option, index)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 ${
                isSelected
                  ? "border-rose-300/70 bg-rose-500/20 text-white"
                  : "border-white/15 bg-white/10 text-slate-100 hover:border-white/35 hover:bg-white/15"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
