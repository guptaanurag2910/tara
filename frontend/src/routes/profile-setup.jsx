import { createFileRoute } from "@tanstack/react-router";

import ProfileSetup from "../pages/ProfileSetup";
import { RequireAuth } from "./_guards";

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

