import { createFileRoute } from "@tanstack/react-router";

import Settings from "../pages/Settings";
import { RequireAuth } from "./_guards";

function SettingsRoute() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

