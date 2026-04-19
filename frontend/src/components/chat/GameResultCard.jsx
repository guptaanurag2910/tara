function ResultRow({ item, userLabel = "You", partnerLabel = "Partner" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e3f]/65 p-3">
      <p className="text-sm text-white/90">{item?.question}</p>
      <div className="mt-1 space-y-1 text-[0.83rem] text-white/80">
        <p>
          <span className="font-semibold text-[#d7be72]">{userLabel}:</span> {item?.user_a || "—"}
        </p>
        <p>
          <span className="font-semibold text-[#d7be72]">{partnerLabel}:</span> {item?.user_b || "—"}
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
    <section className="rounded-[1.7rem] border border-[#2b2f7c]/70 bg-[#0b0e45]/80 p-4 shadow-[0_14px_40px_rgba(6,8,34,0.42)] backdrop-blur">
      <div className="flex items-center justify-between text-[#d7be72]">
        <h3 className="text-[0.84rem] tracking-[0.28em]">
          <span className="mr-2">{gameEmoji(category)}</span>
          {gameLabel(category)}
        </h3>
        <span className="text-sm font-semibold text-white/90">
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

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="font-serif text-[1.18rem] italic text-white/95">
          {result?.summary || "Result ready."}
        </p>
      </div>
    </section>
  );
}
