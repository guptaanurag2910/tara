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
      className={`w-full rounded-2xl border border-[#e7e7e7] bg-white p-4 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#e1306c]">Game Question</p>
      {stepLabel ? <p className="mt-1 text-xs text-[#737373]">{stepLabel}</p> : null}
      <h3 className="mt-2 text-base font-semibold leading-snug text-[#262626]">{question}</h3>

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
                  ? "border-[#e1306c] bg-[#fff0f5] text-[#262626]"
                  : "border-[#dbdbdb] bg-[#fafafa] text-[#262626] hover:border-[#0095f6] hover:bg-white"
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
