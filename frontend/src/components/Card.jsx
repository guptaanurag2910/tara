export default function Card({ children, title, subtitle }) {
  return (
    <section className="tara-screen-panel p-5">
      {title ? <h2 className="tara-type-section text-[2rem]">{title}</h2> : null}
      {subtitle ? <p className="tara-copy mt-2 text-sm">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
