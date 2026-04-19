import { createFileRoute } from "@tanstack/react-router";

import EditProfileSection from "../pages/EditProfileSection";
import { RequireAuth } from "./_guards";

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

