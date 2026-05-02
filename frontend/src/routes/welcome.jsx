import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const WelcomeTransition = lazyRouteComponent(() => import("../pages/WelcomeTransition"), "welcome");

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
