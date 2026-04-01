/**
 * AnimatedCard - Glassmorphic card with animations
 * Features: Press scale, gradient border, glow effects
 */

import React, { useRef } from "react";
import {
  Animated,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, gradients, radius, spacing } from "../../theme";

interface AnimatedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  gradient?: [string, string];
  glowColor?: string;
  borderGlow?: boolean;
  disabled?: boolean;
}

export function AnimatedCard({
  children,
  onPress,
  style,
  gradient,
  glowColor,
  borderGlow = false,
  disabled = false,
}: AnimatedCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const cardContent = (
    <LinearGradient
      colors={gradient || gradients.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      {children}
    </LinearGradient>
  );

  if (!onPress) {
    return (
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        {borderGlow && (
          <Animated.View
            style={[
              styles.glowBorder,
              {
                opacity: glowAnim,
                shadowColor: glowColor || colors.accent,
              },
            ]}
          />
        )}
        {cardContent}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {borderGlow && (
        <Animated.View
          style={[
            styles.glowBorder,
            {
              opacity: glowAnim,
              shadowColor: glowColor || colors.accent,
            },
          ]}
        />
      )}
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
      >
        {cardContent}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  glowBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.xl + 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
});

export default AnimatedCard;
