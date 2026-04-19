import { createFileRoute } from "@tanstack/react-router";

import Matches from "../pages/Matches";
import { RequireAuth } from "./_guards";

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

