import { createFileRoute } from "@tanstack/react-router";

import GameNight from "../pages/GameNight";
import { RequireAuth } from "./_guards";

export const Route = createFileRoute("/game-night")({
  component: () => <RequireAuth><GameNight /></RequireAuth>,
});
