export default function EmptyState({
  eyebrow = "",
  icon = null,
  title,
  subtitle = "",
  action = null,
  compact = false,
  kind = "generic",
}) {
  return (
    <section
      data-empty-kind={kind}
      className={`tara-empty-state ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="tara-empty-body">
        {eyebrow ? <p className="tara-empty-kicker">{eyebrow}</p> : null}
        {icon ? <div className="tara-empty-icon" aria-hidden="true">{icon}</div> : null}
        <p className="tara-empty-title">{title}</p>
        {subtitle ? <p className="tara-empty-copy mt-2">{subtitle}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </section>
  );
}
