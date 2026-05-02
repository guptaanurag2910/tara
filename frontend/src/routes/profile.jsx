import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Profile = lazyRouteComponent(() => import("../pages/Profile"), "profile");

function ProfileRoute() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
});
