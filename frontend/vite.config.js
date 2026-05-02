import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-router-dom": "/src/lib/router-compat.jsx",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("@tanstack/react-router") ||
            id.includes("/axios/")
          ) {
            return "react-core";
          }

          if (
            id.includes("@radix-ui/") ||
            id.includes("/cmdk/") ||
            id.includes("/embla-carousel-react/") ||
            id.includes("/vaul/") ||
            id.includes("/input-otp/") ||
            id.includes("/class-variance-authority/") ||
            id.includes("/clsx/") ||
            id.includes("/tailwind-merge/")
          ) {
            return "ui-kit";
          }

          if (id.includes("/framer-motion/")) {
            return "motion";
          }

          if (id.includes("/recharts/") || id.includes("/react-day-picker/")) {
            return "charts";
          }

          if (id.includes("/lucide-react/")) {
            return "icons";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
