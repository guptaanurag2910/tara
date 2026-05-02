import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const DailyMatches = lazyRouteComponent(() => import("../pages/DailyMatches"), "stars");

function StarsTodayRoute() {
  return (
    <RequireAuth>
      <DailyMatches />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/stars-today")({
  component: StarsTodayRoute,
});
