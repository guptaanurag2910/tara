function ResultRow({ item, userLabel = "You", partnerLabel = "Partner" }) {
  return (
    <div className="tara-support-surface rounded-2xl px-3 py-3">
      <p className="text-sm text-[color:var(--tara-text-primary)]">{item?.question}</p>
      <div className="mt-1 space-y-1 text-[0.83rem] text-[color:var(--tara-text-secondary)]">
        <p>
          <span className="font-semibold text-[color:var(--tara-gold)]">{userLabel}:</span> {item?.user_a || "—"}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--tara-gold)]">{partnerLabel}:</span> {item?.user_b || "—"}
        </p>
      </div>
    </div>
  );
}

function gameLabel(category) {
  const value = String(category || "").toLowerCase();
  if (value === "predict_me") return "PREDICT ME";
  if (value === "deal_breaker") return "DEAL BREAKER";
  return "THIS OR THAT";
}

function gameEmoji(category) {
  const value = String(category || "").toLowerCase();
  if (value === "predict_me") return "🔮";
  if (value === "deal_breaker") return "💔";
  return "⚖️";
}

export default function GameResultCard({
  result,
  category = "this_or_that",
  userLabel = "You",
  partnerLabel = "Partner",
}) {
  if (!result) {
    return null;
  }

  const questions = Array.isArray(result?.questions) ? result.questions : [];

  return (
    <section
      className="tara-screen-panel tara-motion-card-enter rounded-[1.7rem] p-4"
      data-testid="game-result-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="tara-kicker text-[0.8rem]">
          <span className="mr-2">{gameEmoji(category)}</span>
          {gameLabel(category)}
        </h3>
        <span className="tara-chip tara-chip-gold px-2.5 py-1 text-xs font-semibold">
          {result?.matched ?? 0}/{result?.total ?? 0}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {questions.map((item, idx) => (
          <ResultRow
            item={item}
            key={`${item?.question || "q"}-${idx}`}
            partnerLabel={partnerLabel}
            userLabel={userLabel}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-[color:var(--tara-card-border)] pt-3">
        <p className="font-[var(--font-serif)] text-[1.18rem] italic text-[color:var(--tara-text-primary)]">
          {result?.summary || "Result ready."}
        </p>
      </div>
    </section>
  );
}
