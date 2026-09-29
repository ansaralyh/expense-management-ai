import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: {
          50: "#F7F6F3",
          100: "#E8EDF3",
          300: "#9AA3AE",
          400: "#6B7580",
          500: "#4A5560",
          700: "#333333",
          800: "#2D2D2D",
          900: "#1A1A1A",
          950: "#0B1524",
        },
        // Light surfaces via existing slate-* class names
        slate: {
          50: "#0B1524",
          100: "#1A1A1A",
          200: "#1E2A3A",
          300: "#3A4554",
          400: "#525252",
          500: "#7A828C",
          600: "#B7B2A8",
          700: "#D8D4CC",
          800: "#E6E2DA",
          900: "#FFFFFF",
          950: "#F5F3EF",
        },
        // Brand: forest (positive / links)
        emerald: {
          50: "#F1F6F4",
          100: "#DCEAE4",
          200: "#B5D1C6",
          300: "#6FA08F",
          400: "#1F6B56",
          500: "#185544",
          600: "#134338",
          700: "#0E322A",
          800: "#0A241E",
          900: "#071A16",
          950: "#F3F7F5",
        },
        teal: {
          300: "#6FA08F",
          400: "#1F6B56",
          500: "#185544",
          950: "#F3F7F5",
        },
        amber: {
          400: "#8A6A24",
          500: "#A07C2C",
          600: "#6F561C",
          950: "#F7F3E8",
        },
        rose: {
          400: "#9A3F38",
          500: "#86352F",
          950: "#F6EEEC",
        },
        cyan: {
          400: "#2A6B66",
          500: "#215853",
          950: "#EEF5F4",
        },
        purple: {
          300: "#B7A3C9",
          400: "#5A4A72",
          500: "#4A3C5E",
          950: "#F4F1F6",
        },
        blue: {
          400: "#3D5570",
          500: "#334860",
          950: "#EEF2F6",
        },
        brand: {
          50: "#F1F6F4",
          100: "#DCEAE4",
          500: "#185544",
          600: "#134338",
          700: "#0E322A",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-sans)"],
      },
      fontSize: {
        overline: ["10pt", { lineHeight: "1.15" }],
        xs: ["10pt", { lineHeight: "1.15" }],
        sm: ["11pt", { lineHeight: "1.2" }],
        base: ["11pt", { lineHeight: "1.2" }],
        lg: ["13pt", { lineHeight: "1.25" }],
        xl: ["14pt", { lineHeight: "1.25" }],
        "2xl": ["15pt", { lineHeight: "1.3" }],
        "3xl": ["16pt", { lineHeight: "1.3" }],
        "4xl": ["16pt", { lineHeight: "1.3" }],
      },
      letterSpacing: {
        overline: "0.14em",
      },
      borderRadius: {
        "3xl": "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18, 32, 51, 0.04), 0 8px 24px rgba(18, 32, 51, 0.04)",
        lift: "0 12px 32px rgba(18, 32, 51, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
