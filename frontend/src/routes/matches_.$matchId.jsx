import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const MatchDetail = lazyRouteComponent(() => import("../pages/MatchDetail"), "match-detail");

function MatchDetailRoute() {
  return (
    <RequireAuth>
      <MatchDetail />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/matches/$matchId")({
  component: MatchDetailRoute,
});
