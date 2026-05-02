import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Discover = lazyRouteComponent(() => import("../pages/Discover"), "discover");

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
