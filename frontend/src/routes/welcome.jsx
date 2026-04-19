import { createFileRoute } from "@tanstack/react-router";

import WelcomeTransition from "../pages/WelcomeTransition";
import { RequireAuth } from "./_guards";

function WelcomeRoute() {
  return (
    <RequireAuth allowIncompleteOnboarding>
      <WelcomeTransition />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/welcome")({
  component: WelcomeRoute,
});

