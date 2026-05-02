export default function Icebreaker({ suggestions = [], loading = false, onPick }) {
  if (loading) {
    return (
      <div className="mb-3">
        <p className="tara-faint mb-2 text-[11px] uppercase tracking-wide">Icebreakers</p>
        <div className="flex flex-wrap gap-2">
          <div className="tara-skeleton-block h-8 w-40 rounded-full" />
          <div className="tara-skeleton-block h-8 w-48 rounded-full" />
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
            className="tara-chip tara-motion-pressable text-left hover:border-[color:var(--tara-gold)]"
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
