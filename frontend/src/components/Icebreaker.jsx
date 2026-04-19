export default function Icebreaker({ suggestions = [], loading = false, onPick }) {
  if (loading) {
    return (
      <div className="mb-3">
        <p className="tara-faint mb-2 text-[11px] uppercase tracking-wide">Icebreakers</p>
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-40 animate-pulse rounded-full bg-[color:var(--tara-card-bg)]" />
          <div className="h-8 w-48 animate-pulse rounded-full bg-[color:var(--tara-card-bg)]" />
        </div>
      </div>
    );
  }

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="mb-3">
      <p className="tara-faint mb-2 text-[11px] uppercase tracking-wide">Try one to start</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.slice(0, 3).map((text) => (
          <button
            key={text}
            className="rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-card-bg)] px-3 py-1.5 text-left text-xs font-medium text-[color:var(--tara-text-primary)] transition hover:border-[color:var(--tara-gold)]"
            onClick={() => onPick?.(text)}
            type="button"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
