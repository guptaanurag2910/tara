import { createFileRoute } from "@tanstack/react-router";

import EditProfile from "../pages/EditProfile";
import { RequireAuth } from "./_guards";

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

