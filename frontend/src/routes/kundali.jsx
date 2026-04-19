import { createFileRoute } from "@tanstack/react-router";

import Kundali from "../pages/Kundali";
import { RequireAuth } from "./_guards";

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

