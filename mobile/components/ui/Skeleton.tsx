/**
 * Skeleton Loading Components
 * Shimmer effect loading placeholders
 */

import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Animated, ViewStyle, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing } from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: typeof width === "number" ? width : width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255, 255, 255, 0.05)",
            "rgba(255, 255, 255, 0.1)",
            "rgba(255, 255, 255, 0.05)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

// Preset skeleton components
export function SkeletonText({
  lines = 1,
  spacing: lineSpacing = spacing.xs,
  lastLineWidth = "60%",
}: {
  lines?: number;
  spacing?: number;
  lastLineWidth?: string | number;
}) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 && lines > 1 ? lastLineWidth : "100%"}
          height={14}
          style={index < lines - 1 ? { marginBottom: lineSpacing } : undefined}
        />
      ))}
    </View>
  );
}

export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonAvatar size={40} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={14} style={{ marginBottom: spacing.xs }} />
          <Skeleton width={80} height={12} />
        </View>
      </View>
      <SkeletonText lines={3} />
      <View style={styles.cardFooter}>
        <Skeleton width={60} height={24} borderRadius={radius.full} />
        <Skeleton width={80} height={24} borderRadius={radius.full} />
      </View>
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={styles.listItem}>
      <SkeletonAvatar size={48} />
      <View style={styles.listItemContent}>
        <Skeleton width="70%" height={16} style={{ marginBottom: spacing.xs }} />
        <Skeleton width="50%" height={12} />
      </View>
      <Skeleton width={60} height={30} borderRadius={radius.md} />
    </View>
  );
}

export function SkeletonStats() {
  return (
    <View style={styles.statsContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.statItem}>
          <Skeleton width={40} height={40} borderRadius={radius.md} style={{ marginBottom: spacing.xs }} />
          <Skeleton width={60} height={20} style={{ marginBottom: spacing.xs }} />
          <Skeleton width={40} height={12} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonShiftCard() {
  return (
    <View style={styles.shiftCard}>
      <View style={styles.shiftCardLeft}>
        <Skeleton width={48} height={48} borderRadius={radius.md} />
      </View>
      <View style={styles.shiftCardContent}>
        <Skeleton width="80%" height={16} style={{ marginBottom: spacing.xs }} />
        <Skeleton width="60%" height={14} style={{ marginBottom: spacing.xs }} />
        <View style={styles.shiftCardBadges}>
          <Skeleton width={70} height={20} borderRadius={radius.full} />
          <Skeleton width={50} height={20} borderRadius={radius.full} />
        </View>
      </View>
      <View style={styles.shiftCardRight}>
        <Skeleton width={50} height={20} style={{ marginBottom: spacing.xs }} />
        <Skeleton width={30} height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  shimmer: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    flex: 1,
    width: SCREEN_WIDTH * 2,
  },
  textContainer: {
    width: "100%",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listItemContent: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.md,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: "center",
  },
  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftCardLeft: {
    marginRight: spacing.md,
  },
  shiftCardContent: {
    flex: 1,
  },
  shiftCardBadges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  shiftCardRight: {
    alignItems: "flex-end",
    marginLeft: spacing.sm,
  },
});

export default Skeleton;
