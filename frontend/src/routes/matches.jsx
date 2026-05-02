import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Matches = lazyRouteComponent(() => import("../pages/Matches"), "matches");

function MatchesRoute() {
  return (
    <RequireAuth>
      <Matches />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/matches")({
  component: MatchesRoute,
});
