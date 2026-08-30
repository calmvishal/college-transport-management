import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          500: "#3457d5",
          600: "#2a45b0",
          700: "#22378c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
