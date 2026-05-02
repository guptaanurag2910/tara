import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";
import { RequireAuth } from "./_guards";

const Chat = lazyRouteComponent(() => import("../pages/Chat"), "chat-list");

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
