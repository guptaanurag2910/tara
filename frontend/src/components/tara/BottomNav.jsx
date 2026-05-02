import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, MessageCircle, Moon, Sparkles, User } from "lucide-react";

const tabs = [
  { to: "/discover", label: "Discover", Icon: Sparkles },
  { to: "/matches", label: "Matches", Icon: Heart },
  { to: "/chat", label: "Chat", Icon: MessageCircle },
  { to: "/kundali", label: "Kundali", Icon: Moon },
  { to: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const hiddenRoutes = ["/", "/auth", "/login", "/welcome", "/onboarding", "/profile-setup", "/your-vibe"];
  const isHidden = hiddenRoutes.includes(pathname);

  if (isHidden) {
    return null;
  }

  return (
    <nav className="tara-fixed-nav pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="pointer-events-auto w-full max-w-[390px]">
        <div className="glass-strong flex items-center justify-around rounded-3xl px-2 py-2 shadow-elevated">
          {tabs.map(({ to, label, Icon }) => {
            const active =
              pathname === to ||
              (to !== "/discover" && pathname.startsWith(to)) ||
              (to === "/chat" && pathname.startsWith("/chat"));

            return (
              <Link
                key={to}
                to={to}
                className="tara-nav-tab group relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-all"
              >
                <div
                  className={`tara-nav-orb relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
                    active ? "tara-nav-orb-active bg-aurora shadow-glow" : "bg-transparent"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors ${
                      active ? "text-white" : "text-[color:var(--tara-text-faint)] group-hover:text-[color:var(--tara-text-primary)]"
                    }`}
                    strokeWidth={active ? 2.35 : 1.9}
                  />
                </div>
                <span
                  className={`tara-nav-copy text-[10px] font-medium tracking-wide transition-colors ${
                    active
                      ? "tara-nav-copy-active text-[color:var(--tara-text-primary)]"
                      : "text-[color:var(--tara-text-faint)]"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
