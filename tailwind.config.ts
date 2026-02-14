import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shield: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        ink: {
          950: "#0c0d10",
          900: "#13141a",
          800: "#1c1d26",
          700: "#282a33",
          600: "#3d3f4d",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1rem",
        "card-lg": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.25), 0 1px 2px -1px rgb(0 0 0 / 0.2)",
        "card-hover": "0 4px 12px -2px rgb(0 0 0 / 0.2), 0 2px 6px -2px rgb(0 0 0 / 0.15)",
        // Glassmorphism shadows
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-sm": "0 4px 16px 0 rgba(0, 0, 0, 0.25)",
        // Glow effects
        "glow-sm": "0 0 15px rgba(20, 184, 166, 0.3)",
        glow: "0 0 25px rgba(20, 184, 166, 0.4)",
        "glow-lg": "0 0 40px rgba(20, 184, 166, 0.5)",
        "glow-xl": "0 0 60px rgba(20, 184, 166, 0.6)",
        // Inner glow for buttons
        "inner-glow": "inset 0 0 20px rgba(20, 184, 166, 0.15)",
      },
      backdropBlur: {
        xs: "2px",
        glass: "12px",
        "glass-lg": "20px",
      },
      animation: {
        // Floating animation for orbs
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        // Pulse glow for buttons
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        // Gradient shift for backgrounds
        "gradient-shift": "gradient-shift 8s ease infinite",
        // Fade in up for scroll animations
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        // Shimmer effect
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(20, 184, 166, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(20, 184, 166, 0.7)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
