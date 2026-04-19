import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

import BottomNav from "../components/tara/BottomNav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cosmic px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-aurora">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">Lost in the stars</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page drifted out of orbit.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-aurora px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-105"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
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
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-app text-[color:var(--tara-text-primary)]">
      <div className="h-full overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
