export default function Loader({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-[color:var(--tara-text-secondary)]">
      <span
        className="h-2.5 w-2.5 animate-pulse rounded-full"
        style={{ background: "color-mix(in srgb, var(--tara-violet) 72%, white 10%)" }}
      />
      <span
        className="h-2.5 w-2.5 animate-pulse rounded-full [animation-delay:150ms]"
        style={{ background: "color-mix(in srgb, var(--tara-color-info) 64%, white 18%)" }}
      />
      <span
        className="h-2.5 w-2.5 animate-pulse rounded-full [animation-delay:300ms]"
        style={{ background: "color-mix(in srgb, var(--tara-gold) 76%, white 10%)" }}
      />
      <span className="ml-2">{text}</span>
    </div>
  );
}
