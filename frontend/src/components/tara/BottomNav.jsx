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

  const light = pathname === "/discover" || pathname.startsWith("/matches") || pathname === "/kundali" || pathname === "/profile" || pathname.startsWith("/profile/edit") || pathname === "/stars-today" || pathname === "/settings" || pathname === "/chat" || pathname.startsWith("/chat/");

  if (!light) {
    return null;
  }

  return (
    <nav className={`tara-fixed-nav pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center ${light ? "tara-light-bottom-nav px-0 pb-[env(safe-area-inset-bottom)]" : "px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"}`}>
      <div className={`pointer-events-auto w-full ${light ? "max-w-[460px]" : "max-w-[390px]"}`}>
        <div className={`${light ? "tara-light-bottom-nav-inner" : "glass-strong rounded-3xl shadow-elevated"} flex items-center justify-around px-2 py-2`}>
          {tabs.map(({ to, label, Icon }) => {
            const active =
              pathname === to ||
              (to !== "/discover" && pathname.startsWith(to)) ||
              (to === "/chat" && pathname.startsWith("/chat"));

            return (
              <Link
                key={to}
                to={to}
                className="group relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-all"
              >
                <div
                  className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
                    light ? "bg-transparent" : active ? "bg-aurora shadow-glow" : "bg-transparent"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors ${
                      light ? active ? "text-[#0095f6]" : "text-[#8e8e8e] group-hover:text-[#262626]" : active ? "text-white" : "text-[color:var(--tara-text-faint)] group-hover:text-[color:var(--tara-text-primary)]"
                    }`}
                    strokeWidth={active ? 2.35 : 1.9}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium tracking-wide transition-colors ${
                    light ? active ? "text-[#0095f6]" : "text-[#8e8e8e]" : active ? "text-[color:var(--tara-text-primary)]" : "text-[color:var(--tara-text-faint)]"
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
