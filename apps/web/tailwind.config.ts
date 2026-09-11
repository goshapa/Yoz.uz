import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#effcfa",
          100: "#c7f5ee",
          200: "#94ebde",
          300: "#5eddcf",
          400: "#2fc7b8",
          500: "#14a89b",
          600: "#0f867e",
          700: "#106a65",
          800: "#125452",
          900: "#124645",
        },
        sun: {
          50: "#fff7ed",
          100: "#ffedd2",
          200: "#ffd6a3",
          300: "#ffb85e",
          400: "#ff9a3c",
          500: "#f97c1f",
          600: "#dd5f13",
          700: "#b74712",
          800: "#933916",
          900: "#782f15",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1.1rem",
      },
    },
  },
  plugins: [],
};

export default config;
