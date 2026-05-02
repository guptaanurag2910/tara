import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const EditProfileSection = lazyRouteComponent(() => import("../pages/EditProfileSection"), "profile-edit");

function EditProfileSectionRoute() {
  return (
    <RequireAuth>
      <EditProfileSection />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/profile/edit/$section")({
  component: EditProfileSectionRoute,
});
