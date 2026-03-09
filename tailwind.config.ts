import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ipl: {
          blue: "#003B8E",
          orange: "#FF6B35",
          gold: "#FFD700",
          dark: "#0A0E1A",
          card: "#111827",
          muted: "#374151",
        },
      },
      backgroundImage: {
        "gradient-ipl": "linear-gradient(135deg, #003B8E 0%, #0A0E1A 50%, #1a0a00 100%)",
        "gradient-card": "linear-gradient(145deg, #111827, #1f2937)",
        "gradient-gold": "linear-gradient(135deg, #FFD700, #FF6B35)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.5s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #FFD700, 0 0 10px #FFD700" },
          "100%": { boxShadow: "0 0 20px #FFD700, 0 0 40px #FF6B35" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
