import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Kundali = lazyRouteComponent(() => import("../pages/Kundali"), "kundali");

function KundaliRoute() {
  return (
    <RequireAuth>
      <Kundali />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/kundali")({
  component: KundaliRoute,
});
