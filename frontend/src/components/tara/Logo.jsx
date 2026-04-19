export default function Logo({ size = 40 }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-2xl bg-aurora shadow-glow"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2 text-white">
          <path
            d="M12 2 L13.5 9 L21 12 L13.5 15 L12 22 L10.5 15 L3 12 L10.5 9 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <span className="tara-heading text-[2rem] leading-none tracking-tight">tara</span>
    </div>
  );
}
