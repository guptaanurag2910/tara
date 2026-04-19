import { createFileRoute } from "@tanstack/react-router";

import Profile from "../pages/Profile";
import { RequireAuth } from "./_guards";

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

