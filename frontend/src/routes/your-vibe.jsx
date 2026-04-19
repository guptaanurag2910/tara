import { createFileRoute } from "@tanstack/react-router";

import YourVibe from "../pages/YourVibe";
import { RequireAuth } from "./_guards";

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

