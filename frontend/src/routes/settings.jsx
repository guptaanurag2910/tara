import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Settings = lazyRouteComponent(() => import("../pages/Settings"), "settings");

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
