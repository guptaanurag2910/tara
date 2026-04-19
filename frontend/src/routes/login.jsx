import { Navigate, createFileRoute } from "@tanstack/react-router";

function LoginRedirect() {
  return <Navigate to="/auth?mode=login" replace />;
}

export const Route = createFileRoute("/login")({
  component: LoginRedirect,
});
