export default function Card({ children, title, subtitle }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-slate-900/55 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
      {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-xs text-slate-300">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
