/**
 * Shield mobile — design tokens with glassmorphism support
 */

export const colors = {
  // Base
  background: "#0c0d10",
  surface: "rgba(255,255,255,0.05)",
  surfaceElevated: "rgba(255,255,255,0.08)",
  
  // Glass effects
  glass: "rgba(255,255,255,0.03)",
  glassStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderLight: "rgba(255,255,255,0.12)",
  
  // Borders
  border: "rgba(255,255,255,0.08)",
  borderMuted: "rgba(255,255,255,0.06)",
  
  // Text
  text: "#fafafa",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  
  // Accent (teal)
  accent: "#2dd4bf",
  accentMuted: "rgba(45,212,191,0.25)",
  accentSoft: "rgba(45,212,191,0.15)",
  accentGlow: "rgba(20,184,166,0.4)",
  
  // Status colors
  success: "#34d399",
  successSoft: "rgba(52,211,153,0.2)",
  warning: "#f59e0b",
  warningSoft: "rgba(245,158,11,0.2)",
  error: "#f87171",
  errorSoft: "rgba(248,113,113,0.2)",
  info: "#60a5fa",
  infoSoft: "rgba(96,165,250,0.2)",
  
  // Buttons
  primaryBtn: "#14b8a6",
  primaryBtnPressed: "#0d9488",
  
  // Gradient colors
  gradientStart: "#0c0d10",
  gradientMid: "#0f1419",
  gradientEnd: "#0c0d10",
  
  // Orb colors for background
  orbTeal: "rgba(20,184,166,0.15)",
  orbCyan: "rgba(6,182,212,0.12)",
} as const;

export const typography = {
  display: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.5, lineHeight: 32 },
  title: { fontSize: 20, fontWeight: "600" as const, letterSpacing: -0.3, lineHeight: 26 },
  titleCard: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  captionMuted: { fontSize: 11, fontWeight: "500" as const },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

// Shadow styles for glow effects
export const shadows = {
  glow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glowSm: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// Animation configs for Reanimated
export const animations = {
  spring: {
    damping: 20,
    stiffness: 300,
  },
  springGentle: {
    damping: 25,
    stiffness: 200,
  },
  timing: {
    duration: 300,
  },
  timingSlow: {
    duration: 500,
  },
} as const;
