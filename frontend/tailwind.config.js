/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Avenir Next", "Segoe UI", "sans-serif"],
        serif: ["var(--font-serif)"]
      },
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#2563eb",
          700: "#1d4ed8"
        }
      }
    }
  },
  plugins: [],
};
