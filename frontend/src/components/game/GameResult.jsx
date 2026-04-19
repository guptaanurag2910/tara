import { useEffect, useState } from "react";

import Button from "../Button";

export default function GameResult({
  resultText,
  onNext,
  nextLabel = "Next Question",
  compact = false,
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), 20);
    return () => window.clearTimeout(timer);
  }, [resultText]);

  return (
    <section
      className={`w-full rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 shadow-xl shadow-black/20 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Result</p>
      <p className="mt-2 text-sm leading-relaxed text-emerald-50">{resultText}</p>

      {onNext ? (
        <div className={compact ? "mt-3" : "mt-4"}>
          <Button onClick={onNext} fullWidth variant="ghost">
            {nextLabel}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
