import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Chat = lazyRouteComponent(() => import("../pages/Chat"), "chat-detail");

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
