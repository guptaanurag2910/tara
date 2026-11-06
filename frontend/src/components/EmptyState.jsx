export default function EmptyState({
  title,
  subtitle = "",
  action = null,
  compact = false,
}) {
  return (
    <section
      className={`tara-empty-state ${compact ? "is-compact" : ""}`}
    >
      <span className="tara-empty-state-mark" aria-hidden="true" />
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {action ? <div className="tara-empty-state-action">{action}</div> : null}
    </section>
  );
}
