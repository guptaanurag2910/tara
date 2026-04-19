import { createFileRoute } from "@tanstack/react-router";

import Chat from "../pages/Chat";
import { RequireAuth } from "./_guards";

function ChatRoute() {
  return (
    <RequireAuth>
      <Chat />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/chat")({
  component: ChatRoute,
});

