import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { AuthProvider } from "./context/AuthContext";
import { getRouter } from "./router";
import { initAppearanceTheme } from "./services/settingsService";
import "./styles/index.css";

initAppearanceTheme();
const router = getRouter();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
