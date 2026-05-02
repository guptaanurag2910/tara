import { createFileRoute } from "@tanstack/react-router";

import { lazyRouteComponent } from "./_lazyRoute";

const Login = lazyRouteComponent(() => import("../pages/Login"), "auth");

export const Route = createFileRoute("/auth")({
  component: Login,
});
