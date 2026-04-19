import { createFileRoute } from "@tanstack/react-router";

import Discover from "../pages/Discover";
import { RequireAuth } from "./_guards";

function DiscoverRoute() {
  return (
    <RequireAuth>
      <Discover />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/discover")({
  component: DiscoverRoute,
});

