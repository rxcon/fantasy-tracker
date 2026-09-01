import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        field: {
          950: "#0A120D",
          900: "#0F1B14",
          800: "#16261C",
          700: "#203528",
          600: "#2C4736",
        },
        lights: {
          400: "#F2B441",
          500: "#EFA525",
          600: "#D98C12",
        },
        chalk: {
          100: "#F4F6F3",
          300: "#C8D2C9",
          500: "#8B9A8F",
        },
        sleeper: "#6366F1",
        espn: "#DC2626",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
