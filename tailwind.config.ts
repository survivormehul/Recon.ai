import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        finance: {
          matched: "#10B981", // Emerald
          resolved: "#06B6D4", // Cyan
          review: "#F59E0B", // Amber
          unresolved: "#EF4444", // Red/Rose
          conflict: "#EC4899", // Pink
          duplicate: "#8B5CF6", // Purple
          missing: "#6B7280", // Gray
        },
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          900: "#1E1B4B",
        }
      },
    },
  },
  plugins: [],
};
export default config;
