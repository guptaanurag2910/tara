import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";

import NotificationBell from "../components/NotificationBell";
import BottomNav from "../components/tara/BottomNav";
import { useAuth } from "../hooks/useAuth";

function NotFoundComponent() {
  return (
    <main className="tara-not-found">
      <div className="not-found-brand">tara<span>.</span></div>
      <div className="not-found-content">
        <span className="not-found-code">404</span>
        <h1>Page not found</h1>
        <p>The page you&apos;re looking for isn&apos;t here. Let&apos;s get you back on track.</p>
        <Link to="/">Return home</Link>
      </div>
    </main>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "theme-color", content: "#16102b" },
      { title: "Tara — Love written in the stars" },
      {
        name: "description",
        content:
          "A dating app where astrology meets personality. Match through kundali, vibe, and meaningful conversation.",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { token } = useAuth();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
  const isMemberRoute = ["/discover", "/matches", "/kundali", "/profile", "/stars-today", "/your-vibe", "/settings"].includes(pathname) || pathname.startsWith("/matches/") || pathname.startsWith("/profile/edit") || isChatRoute;
  const showNotifications = Boolean(token) && isMemberRoute;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#fafafa] text-[color:var(--tara-text-primary)]">
      <div className="relative h-full overflow-x-hidden overflow-y-auto overscroll-contain">
        <Outlet />
        {showNotifications ? <NotificationBell light /> : null}
      </div>
      {!isAdminRoute ? <BottomNav /> : null}
    </div>
  );
}
