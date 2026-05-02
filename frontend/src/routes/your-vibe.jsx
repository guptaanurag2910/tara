import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const YourVibe = lazyRouteComponent(() => import("../pages/YourVibe"), "your-vibe");

function YourVibeRoute() {
  return (
    <RequireAuth>
      <YourVibe />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/your-vibe")({
  component: YourVibeRoute,
});
