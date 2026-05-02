import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const EditProfile = lazyRouteComponent(() => import("../pages/EditProfile"), "profile-edit");

function EditProfileRoute() {
  return (
    <RequireAuth>
      <EditProfile />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/profile/edit")({
  component: EditProfileRoute,
});
