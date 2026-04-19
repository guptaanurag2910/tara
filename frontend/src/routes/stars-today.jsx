import { createFileRoute } from "@tanstack/react-router";

import DailyMatches from "../pages/DailyMatches";
import { RequireAuth } from "./_guards";

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

