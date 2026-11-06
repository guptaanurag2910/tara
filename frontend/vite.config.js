import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-router-dom": "/src/lib/router-compat.jsx",
    },
  },
  server: {
    port: 3003,
    strictPort: true,
  },
});
