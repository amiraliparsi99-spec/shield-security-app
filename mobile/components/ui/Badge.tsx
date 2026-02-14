import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, typography, spacing, radius } from "../../theme";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "accent";
  size?: "sm" | "md";
  icon?: string;
  style?: ViewStyle;
}

export function Badge({
  label,
  variant = "default",
  size = "sm",
  icon,
  style,
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], styles[`size_${size}`], style]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
        {label}
      </Text>
    </View>
  );
}

// Status-specific badges
export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeProps["variant"]; label: string; icon?: string }> = {
    available: { variant: "success", label: "Available", icon: "🟢" },
    looking: { variant: "info", label: "Looking", icon: "👀" },
    booked: { variant: "warning", label: "Booked", icon: "📅" },
    off: { variant: "default", label: "Off", icon: "💤" },
    pending: { variant: "warning", label: "Pending", icon: "⏳" },
    confirmed: { variant: "success", label: "Confirmed", icon: "✓" },
    completed: { variant: "accent", label: "Completed", icon: "✓" },
    cancelled: { variant: "error", label: "Cancelled", icon: "✕" },
  };

  const { variant, label, icon } = config[status] || { variant: "default", label: status };

  return <Badge label={label} variant={variant} icon={icon} />;
}

// Verification badge
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge label="Verified" variant="success" icon="✓" />
  ) : (
    <Badge label="Unverified" variant="default" icon="?" />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },

  // Variants
  default: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  success: {
    backgroundColor: colors.successSoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
  },
  error: {
    backgroundColor: colors.errorSoft,
  },
  info: {
    backgroundColor: colors.infoSoft,
  },
  accent: {
    backgroundColor: colors.accentSoft,
  },

  // Sizes
  size_sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  size_md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  // Text
  text: {
    fontWeight: "500",
  },
  text_default: {
    color: colors.textMuted,
  },
  text_success: {
    color: colors.success,
  },
  text_warning: {
    color: colors.warning,
  },
  text_error: {
    color: colors.error,
  },
  text_info: {
    color: colors.info,
  },
  text_accent: {
    color: colors.accent,
  },

  textSize_sm: {
    ...typography.caption,
  },
  textSize_md: {
    ...typography.bodySmall,
  },

  icon: {
    fontSize: 10,
  },
});

export default Badge;
