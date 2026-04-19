export default function EmptyState({
  title,
  subtitle = "",
  action = null,
  compact = false,
}) {
  return (
    <section
      className={`rounded-2xl border border-white/15 bg-slate-900/55 text-center shadow-lg shadow-black/20 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <p className="text-base font-semibold text-white">{title}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-300">{subtitle}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
