import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const ProfileSetup = lazyRouteComponent(() => import("../pages/ProfileSetup"), "onboarding");

function ProfileSetupRoute() {
  return (
    <RequireAuth allowIncompleteOnboarding>
      <ProfileSetup />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/profile-setup")({
  component: ProfileSetupRoute,
});
