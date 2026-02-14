/**
 * Premium Card Component
 * Animated card with press effects, swipe actions, and glassmorphism
 */

import React, { useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PremiumCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "glass" | "gradient";
  gradientColors?: [string, string];
  swipeActions?: {
    left?: { color: string; icon: string; onSwipe: () => void };
    right?: { color: string; icon: string; onSwipe: () => void };
  };
  disabled?: boolean;
}

export function PremiumCard({
  children,
  onPress,
  onLongPress,
  style,
  variant = "default",
  gradientColors = ["#1a1a2e", "#16213e"],
  swipeActions,
  disabled = false,
}: PremiumCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeThreshold = SCREEN_WIDTH * 0.25;

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [disabled]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || !onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [disabled, onPress]);

  const handleLongPress = useCallback(() => {
    if (disabled || !onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [disabled, onLongPress]);

  // Pan responder for swipe actions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!swipeActions,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !!swipeActions && Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (!swipeActions) return;
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!swipeActions) return;

        if (gestureState.dx > swipeThreshold && swipeActions.right) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            swipeActions.right!.onSwipe();
            translateX.setValue(0);
          });
        } else if (gestureState.dx < -swipeThreshold && swipeActions.left) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            swipeActions.left!.onSwipe();
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            tension: 200,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Render swipe backgrounds
  const renderSwipeBackgrounds = () => {
    if (!swipeActions) return null;

    return (
      <View style={styles.swipeBackgrounds}>
        {swipeActions.left && (
          <View style={[styles.swipeBackground, styles.swipeLeft, { backgroundColor: swipeActions.left.color }]}>
            <Text style={styles.swipeIcon}>{swipeActions.left.icon}</Text>
          </View>
        )}
        {swipeActions.right && (
          <View style={[styles.swipeBackground, styles.swipeRight, { backgroundColor: swipeActions.right.color }]}>
            <Text style={styles.swipeIcon}>{swipeActions.right.icon}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render card content based on variant
  const renderCardContent = () => {
    const content = (
      <View style={[styles.cardContent, disabled && styles.disabled]}>
        {children}
      </View>
    );

    switch (variant) {
      case "glass":
        return (
          <BlurView intensity={20} tint="dark" style={styles.blurView}>
            {content}
          </BlurView>
        );
      case "gradient":
        return (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {content}
          </LinearGradient>
        );
      case "elevated":
        return <View style={[styles.elevated, content.props.style]}>{children}</View>;
      default:
        return content;
    }
  };

  const Card = onPress || onLongPress ? TouchableOpacity : View;

  return (
    <View style={styles.container}>
      {renderSwipeBackgrounds()}
      <Animated.View
        {...(swipeActions ? panResponder.panHandlers : {})}
        style={[
          styles.cardWrapper,
          {
            transform: [
              { scale: scaleAnim },
              { translateX: swipeActions ? translateX : 0 },
            ],
          },
          style,
        ]}
      >
        <Card
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          style={[
            styles.card,
            variant === "elevated" && styles.elevatedCard,
            variant === "glass" && styles.glassCard,
          ]}
        >
          {renderCardContent()}
        </Card>
      </Animated.View>
    </View>
  );
}

// Preset card variants
export function ShiftCard({
  title,
  subtitle,
  time,
  earnings,
  status,
  onPress,
}: {
  title: string;
  subtitle: string;
  time: string;
  earnings: string;
  status: "confirmed" | "pending" | "completed";
  onPress: () => void;
}) {
  const statusColors = {
    confirmed: colors.success,
    pending: colors.warning,
    completed: colors.textMuted,
  };

  return (
    <PremiumCard onPress={onPress} variant="elevated">
      <View style={styles.shiftCard}>
        <View style={styles.shiftInfo}>
          <Text style={styles.shiftTitle}>{title}</Text>
          <Text style={styles.shiftSubtitle}>{subtitle}</Text>
          <View style={styles.shiftMeta}>
            <Text style={styles.shiftTime}>🕐 {time}</Text>
            <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
            <Text style={[styles.statusText, { color: statusColors[status] }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.shiftEarnings}>
          <Text style={styles.earningsAmount}>{earnings}</Text>
          <Text style={styles.earningsLabel}>Est.</Text>
        </View>
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  cardWrapper: {
    zIndex: 1,
  },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevatedCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardContent: {
    padding: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  blurView: {
    overflow: "hidden",
  },
  gradient: {
    borderRadius: radius.lg,
  },
  elevated: {
    padding: spacing.md,
  },
  swipeBackgrounds: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  swipeBackground: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  swipeLeft: {
    alignItems: "flex-end",
  },
  swipeRight: {
    alignItems: "flex-start",
  },
  swipeIcon: {
    fontSize: 24,
  },
  // Shift Card styles
  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
  },
  shiftInfo: {
    flex: 1,
  },
  shiftTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginBottom: 2,
  },
  shiftSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  shiftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  shiftTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "600",
  },
  shiftEarnings: {
    alignItems: "flex-end",
  },
  earningsAmount: {
    ...typography.title,
    color: colors.text,
    fontWeight: "700",
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
});

export default PremiumCard;
