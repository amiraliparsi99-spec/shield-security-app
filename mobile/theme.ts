/**
 * Shield mobile — design tokens with glassmorphism support
 * Enhanced with vibrant gradients and modern styling
 */

export const colors = {
  // Base - deeper, richer dark
  background: "#080a0f",
  backgroundAlt: "#0d1117",
  surface: "rgba(255,255,255,0.04)",
  surfaceElevated: "rgba(255,255,255,0.07)",
  surfaceHover: "rgba(255,255,255,0.10)",
  
  // Glass effects - enhanced
  glass: "rgba(255,255,255,0.03)",
  glassStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderLight: "rgba(255,255,255,0.12)",
  glassBorderAccent: "rgba(45,212,191,0.2)",
  
  // Borders
  border: "rgba(255,255,255,0.08)",
  borderMuted: "rgba(255,255,255,0.05)",
  borderActive: "rgba(45,212,191,0.4)",
  
  // Text - improved contrast
  text: "#ffffff",
  textSecondary: "#b4b4b4",
  textMuted: "#6b7280",
  textInverse: "#0c0d10",
  
  // Primary accent (vibrant teal/cyan)
  accent: "#00d4aa",
  accentLight: "#5eead4",
  accentDark: "#0d9488",
  accentMuted: "rgba(0,212,170,0.25)",
  accentSoft: "rgba(0,212,170,0.12)",
  accentGlow: "rgba(0,212,170,0.5)",
  
  // Secondary accent (purple/violet)
  secondary: "#a78bfa",
  secondaryLight: "#c4b5fd",
  secondaryDark: "#7c3aed",
  secondarySoft: "rgba(167,139,250,0.15)",
  
  // Status colors - more vibrant
  success: "#22c55e",
  successLight: "#4ade80",
  successSoft: "rgba(34,197,94,0.15)",
  successGlow: "rgba(34,197,94,0.4)",
  
  warning: "#f59e0b",
  warningLight: "#fbbf24",
  warningSoft: "rgba(245,158,11,0.15)",
  warningGlow: "rgba(245,158,11,0.4)",
  
  error: "#ef4444",
  errorLight: "#f87171",
  errorSoft: "rgba(239,68,68,0.15)",
  errorGlow: "rgba(239,68,68,0.4)",
  
  info: "#3b82f6",
  infoLight: "#60a5fa",
  infoSoft: "rgba(59,130,246,0.15)",
  
  // Live/Active indicator
  live: "#22c55e",
  liveGlow: "rgba(34,197,94,0.6)",
  
  // Buttons
  primaryBtn: "#00d4aa",
  primaryBtnPressed: "#00b894",
  primaryBtnGlow: "rgba(0,212,170,0.3)",
  
  // Gradient colors
  gradientStart: "#080a0f",
  gradientMid: "#0d1117",
  gradientEnd: "#080a0f",
  
  // Card gradients
  cardGradientStart: "rgba(255,255,255,0.03)",
  cardGradientEnd: "rgba(255,255,255,0.01)",
  
  // Orb colors for animated background
  orbTeal: "rgba(0,212,170,0.12)",
  orbCyan: "rgba(6,182,212,0.10)",
  orbPurple: "rgba(139,92,246,0.08)",
  orbBlue: "rgba(59,130,246,0.08)",
} as const;

// Gradient presets for LinearGradient
export const gradients = {
  // Card backgrounds
  card: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"] as [string, string],
  cardHover: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.03)"] as [string, string],
  
  // Accent gradients
  accent: ["#00d4aa", "#0d9488"] as [string, string],
  accentSoft: ["rgba(0,212,170,0.2)", "rgba(0,212,170,0.05)"] as [string, string],
  
  // Status gradients
  success: ["#22c55e", "#16a34a"] as [string, string],
  successSoft: ["rgba(34,197,94,0.2)", "rgba(34,197,94,0.05)"] as [string, string],
  
  warning: ["#f59e0b", "#d97706"] as [string, string],
  warningSoft: ["rgba(245,158,11,0.2)", "rgba(245,158,11,0.05)"] as [string, string],
  
  error: ["#ef4444", "#dc2626"] as [string, string],
  
  // Premium/special gradients
  premium: ["#a78bfa", "#7c3aed"] as [string, string],
  gold: ["#fbbf24", "#f59e0b"] as [string, string],
  
  // Background orbs
  orbTeal: ["rgba(0,212,170,0.15)", "rgba(0,212,170,0)"] as [string, string],
  orbPurple: ["rgba(139,92,246,0.12)", "rgba(139,92,246,0)"] as [string, string],
  
  // Dark cards
  darkCard: ["#12151c", "#0d1017"] as [string, string],
  darkCardAlt: ["#151a24", "#0f1318"] as [string, string],
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
