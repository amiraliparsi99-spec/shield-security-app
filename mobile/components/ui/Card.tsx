import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { colors, spacing, radius } from "../../theme";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "outlined" | "glass";
  onPress?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
  style?: ViewStyle;
}

export function Card({
  children,
  variant = "default",
  onPress,
  padding = "md",
  style,
}: CardProps) {
  const cardStyles = [
    styles.base,
    styles[variant],
    styles[`padding_${padding}`],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

// Specialized cards
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  style,
}: StatCardProps) {
  return (
    <Card variant="default" style={[styles.statCard, style]}>
      <View style={styles.statHeader}>
        {icon && <View style={styles.statIcon}>{icon}</View>}
        <View style={styles.statInfo}>
          <View style={styles.statLabelRow}>
            <View style={styles.statLabel}>
              <View style={styles.statLabelText} />
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

interface ListItemCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListItemCard({
  title,
  subtitle,
  meta,
  leftContent,
  rightContent,
  onPress,
  style,
}: ListItemCardProps) {
  const content = (
    <View style={styles.listItemContent}>
      {leftContent && <View style={styles.listItemLeft}>{leftContent}</View>}
      <View style={styles.listItemCenter}>
        <View style={styles.listItemTitle} />
        {subtitle && <View style={styles.listItemSubtitle} />}
        {meta && <View style={styles.listItemMeta} />}
      </View>
      {rightContent && <View style={styles.listItemRight}>{rightContent}</View>}
    </View>
  );

  return (
    <Card variant="default" padding="md" onPress={onPress} style={style}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },

  // Variants
  default: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  outlined: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  glass: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  // Padding
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: spacing.sm,
  },
  padding_md: {
    padding: spacing.md,
  },
  padding_lg: {
    padding: spacing.lg,
  },

  // Stat card
  statCard: {
    minHeight: 100,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statInfo: {
    flex: 1,
  },
  statLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  statLabelText: {
    height: 12,
    width: 60,
    backgroundColor: colors.textMuted,
    borderRadius: 4,
  },

  // List item card
  listItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  listItemLeft: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  listItemCenter: {
    flex: 1,
    gap: spacing.xs,
  },
  listItemTitle: {
    height: 16,
    width: "70%",
    backgroundColor: colors.text,
    borderRadius: 4,
  },
  listItemSubtitle: {
    height: 12,
    width: "50%",
    backgroundColor: colors.textMuted,
    borderRadius: 4,
  },
  listItemMeta: {
    height: 12,
    width: "40%",
    backgroundColor: colors.textMuted,
    borderRadius: 4,
  },
  listItemRight: {
    alignItems: "flex-end",
  },
});

export default Card;
