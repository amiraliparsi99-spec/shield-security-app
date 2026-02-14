/**
 * Greeting Header Component
 * Shows personalized greeting with time-based message
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing } from "../../theme";

interface GreetingHeaderProps {
  name: string;
  subtitle?: string;
  avatarEmoji?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function GreetingHeader({ name, subtitle, avatarEmoji = "👋" }: GreetingHeaderProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(emojiScale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const firstName = name.split(" ")[0];
  const greeting = getGreeting();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{firstName}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Animated.View
        style={[
          styles.emojiContainer,
          { transform: [{ scale: emojiScale }] },
        ]}
      >
        <LinearGradient
          colors={["rgba(45, 212, 191, 0.2)", "rgba(45, 212, 191, 0.05)"]}
          style={styles.emojiGradient}
        >
          <Text style={styles.emoji}>{avatarEmoji}</Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
  },
  name: {
    ...typography.display,
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 2,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 4,
  },
  emojiContainer: {
    marginLeft: spacing.md,
  },
  emojiGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 28,
  },
});

export default GreetingHeader;
