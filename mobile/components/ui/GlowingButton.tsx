/**
 * GlowingButton - Animated button with glow effect
 */

import React, { useRef, useEffect } from "react";
import {
  Animated,
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, gradients, typography, radius, spacing } from "../../theme";

interface GlowingButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "success" | "warning" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  pulse?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function GlowingButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  pulse = false,
  style,
  textStyle,
}: GlowingButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse && !disabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [pulse, disabled]);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(glowAnim, {
        toValue: 0.8,
        duration: 100,
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
        toValue: 0.3,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const getGradient = (): [string, string] => {
    switch (variant) {
      case "success":
        return gradients.success;
      case "warning":
        return gradients.warning;
      case "secondary":
        return gradients.premium;
      case "ghost":
        return ["transparent", "transparent"];
      default:
        return gradients.accent;
    }
  };

  const getGlowColor = () => {
    switch (variant) {
      case "success":
        return colors.successGlow;
      case "warning":
        return colors.warningGlow;
      case "secondary":
        return colors.secondarySoft;
      case "ghost":
        return "transparent";
      default:
        return colors.accentGlow;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return { paddingVertical: 10, paddingHorizontal: 16 };
      case "lg":
        return { paddingVertical: 18, paddingHorizontal: 28 };
      default:
        return { paddingVertical: 14, paddingHorizontal: 22 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return 13;
      case "lg":
        return 17;
      default:
        return 15;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
          shadowColor: getGlowColor(),
          shadowOpacity: glowAnim,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        <LinearGradient
          colors={disabled ? ["#374151", "#1f2937"] : getGradient()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            getSizeStyles(),
            variant === "ghost" && styles.ghost,
          ]}
        >
          {loading ? (
            <Text style={[styles.text, { fontSize: getFontSize() }]}>...</Text>
          ) : (
            <Text
              style={[
                styles.text,
                { fontSize: getFontSize() },
                variant === "ghost" && styles.ghostText,
                textStyle,
              ]}
            >
              {icon ? `${icon} ${title}` : title}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.glassBorderLight,
  },
  text: {
    color: colors.textInverse,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  ghostText: {
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default GlowingButton;
