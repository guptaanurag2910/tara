import BottomNav from "./BottomNav";

export default function AppShell({ children, hideNav = false }) {
  return (
    <div className="relative mx-auto min-h-[100dvh] w-full max-w-[390px] overflow-hidden bg-cosmic">
      <div className="star-field pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-20 -top-32 h-72 w-72 rounded-full bg-glow blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-glow opacity-70 blur-3xl" />

      <div className={`relative z-10 ${hideNav ? "" : "pb-[calc(7rem+env(safe-area-inset-bottom))]"}`}>{children}</div>
      {!hideNav ? <BottomNav /> : null}
    </div>
  );
}
