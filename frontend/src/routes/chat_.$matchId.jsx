import { createFileRoute } from "@tanstack/react-router";

import Chat from "../pages/Chat";
import { RequireAuth } from "./_guards";

function ChatDetailRoute() {
  return (
    <RequireAuth>
      <Chat />
    </RequireAuth>
  );
}

export const Route = createFileRoute("/chat/$matchId")({
  component: ChatDetailRoute,
});

