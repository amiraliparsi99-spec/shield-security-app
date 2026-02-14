/**
 * Glassmorphism UI components for Shield mobile
 * Uses standard React Native Animated API for Expo Go compatibility
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, shadows, typography } from "../../theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================
// GRADIENT BACKGROUND
// ============================================

interface GradientBackgroundProps {
  children: React.ReactNode;
  showOrbs?: boolean;
}

export function GradientBackground({ children, showOrbs = true }: GradientBackgroundProps) {
  return (
    <View style={styles.gradientContainer}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Mesh gradient overlay */}
      <View style={styles.meshOverlay} />
      {/* Floating orbs */}
      {showOrbs && (
        <>
          <FloatingOrb
            size={300}
            color={colors.orbTeal}
            style={{ position: "absolute", top: -100, left: -100 }}
            delay={0}
          />
          <FloatingOrb
            size={250}
            color={colors.orbCyan}
            style={{ position: "absolute", bottom: 100, right: -80 }}
            delay={2000}
          />
          <FloatingOrb
            size={200}
            color={colors.orbTeal}
            style={{ position: "absolute", top: SCREEN_HEIGHT * 0.4, left: -50 }}
            delay={4000}
          />
        </>
      )}
      {/* Grid pattern overlay */}
      <View style={styles.gridOverlay} />
      {children}
    </View>
  );
}

// ============================================
// FLOATING ORB
// ============================================

interface FloatingOrbProps {
  size: number;
  color: string;
  style?: ViewStyle;
  delay?: number;
}

function FloatingOrb({ size, color, style, delay = 0 }: FloatingOrbProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: 20,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ translateY }, { scale }],
        },
        style,
      ]}
    />
  );
}

// ============================================
// GLASS CARD
// ============================================

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  onPress?: () => void;
}

export function GlassCard({
  children,
  style,
  intensity = 20,
  onPress,
}: GlassCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  const content = (
    <View style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.glassInner} />
      </BlurView>
      <View style={styles.glassContent}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>{content}</Animated.View>
      </TouchableOpacity>
    );
  }

  return content;
}

// ============================================
// GLOW BUTTON
// ============================================

interface GlowButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: ViewStyle;
}

export function GlowButton({
  children,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: GlowButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const isPrimary = variant === "primary";

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.glowButton,
          isPrimary ? styles.glowButtonPrimary : styles.glowButtonSecondary,
          isPrimary && shadows.glow,
          disabled && styles.buttonDisabled,
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
      >
        {isPrimary && (
          <LinearGradient
            colors={[colors.primaryBtn, colors.primaryBtnPressed]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <View style={styles.buttonContent}>{children}</View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ============================================
// ANIMATED CONTAINER (for staggered children)
// ============================================

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}

export function FadeInView({ children, delay = 0, style }: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function SlideInView({ children, delay = 0, style }: FadeInViewProps) {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ============================================
// GLASS TAB BAR BACKGROUND
// ============================================

export function GlassTabBarBackground() {
  return (
    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.tabBarGlassInner} />
    </BlurView>
  );
}

// ============================================
// SHIMMER EFFECT
// ============================================

interface ShimmerProps {
  width: number;
  height: number;
  style?: ViewStyle;
}

export function Shimmer({ width, height, style }: ShimmerProps) {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={[{ width, height, overflow: "hidden", borderRadius: radius.sm }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
      <Animated.View style={{ transform: [{ translateX }] }}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.1)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: width * 2, height }}
        />
      </Animated.View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  meshOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  glassCard: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  glassInner: {
    flex: 1,
    backgroundColor: colors.glass,
  },
  glassContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
  },
  glowButton: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  glowButtonPrimary: {
    backgroundColor: colors.primaryBtn,
  },
  glowButtonSecondary: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  buttonContent: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  tabBarGlassInner: {
    flex: 1,
    backgroundColor: "rgba(12,13,16,0.8)",
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
});

// Export Animated for any screens that need it
export { Animated };
