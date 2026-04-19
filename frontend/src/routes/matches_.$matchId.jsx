import { createFileRoute } from "@tanstack/react-router";

import MatchDetail from "../pages/MatchDetail";
import { RequireAuth } from "./_guards";

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

