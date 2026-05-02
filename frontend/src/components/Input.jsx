export default function Input({ label, id, error, ...props }) {
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1.5 block font-medium tara-copy">{label}</span>
      <input className="tara-input" id={id} {...props} />
      {error ? <span className="mt-1 block text-xs text-[color:var(--tara-color-destructive)]">{error}</span> : null}
    </label>
  );
}
