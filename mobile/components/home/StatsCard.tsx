/**
 * Stats Card Component
 * Animated statistics card with gradient background
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";

interface Stat {
  label: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
}

interface StatsCardProps {
  title: string;
  icon: string;
  stats: Stat[];
  onPress?: () => void;
  gradient?: [string, string];
}

export function StatsCard({
  title,
  icon,
  stats,
  onPress,
  gradient = ["#1a1a2e", "#16213e"],
}: StatsCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePress = () => {
    if (!onPress) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  const Card = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Card onPress={handlePress} activeOpacity={0.9}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.header}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.title}>{title}</Text>
            {onPress && <Text style={styles.arrow}>→</Text>}
          </View>
          
          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View
                key={index}
                style={[
                  styles.statItem,
                  index < stats.length - 1 && styles.statItemBorder,
                ]}
              >
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
                {stat.change && (
                  <Text
                    style={[
                      styles.statChange,
                      stat.changePositive
                        ? styles.changePositive
                        : styles.changeNegative,
                    ]}
                  >
                    {stat.changePositive ? "↑" : "↓"} {stat.change}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </LinearGradient>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  arrow: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statItemBorder: {
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.1)",
  },
  statValue: {
    ...typography.display,
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  statChange: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  changePositive: {
    color: colors.success,
  },
  changeNegative: {
    color: colors.error,
  },
});

export default StatsCard;
