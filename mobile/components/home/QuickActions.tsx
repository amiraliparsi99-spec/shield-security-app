/**
 * Quick Actions Component
 * Row of quick action buttons with animations
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  gradient?: [string, string];
  badge?: number;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
}

function QuickActionItem({ action, index }: { action: QuickAction; index: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 100),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 15,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [index]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    action.onPress();
  };

  const gradient = action.gradient || ["rgba(45, 212, 191, 0.15)", "rgba(45, 212, 191, 0.05)"];

  return (
    <Animated.View
      style={[
        styles.actionContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionCard}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{action.icon}</Text>
            {action.badge !== undefined && action.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>{action.label}</Text>
          {action.sublabel && (
            <Text style={styles.sublabel} numberOfLines={1}>{action.sublabel}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function QuickActions({ actions, title }: QuickActionsProps) {
  return (
    <View style={styles.container}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.actionsRow}>
        {actions.map((action, index) => (
          <QuickActionItem key={action.id} action={action} index={index} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  actionContainer: {
    flex: 1,
  },
  actionCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    minHeight: 100,
  },
  iconContainer: {
    position: "relative",
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 28,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
  },
  label: {
    ...typography.body,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  sublabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
});

export default QuickActions;
