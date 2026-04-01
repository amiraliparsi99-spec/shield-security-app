/**
 * AnimatedBackground - Floating orbs background effect
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme";

const { width, height } = Dimensions.get("window");

interface OrbProps {
  size: number;
  color: string;
  initialX: number;
  initialY: number;
  duration: number;
}

function FloatingOrb({ size, color, initialX, initialY, duration }: OrbProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Floating animation
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 30,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -30,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -20,
            duration: duration * 0.8,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: duration * 0.8,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: duration * 0.8,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: duration * 0.5,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: duration * 0.5,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: duration * 0.5,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: initialX,
          top: initialY,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  );
}

interface AnimatedBackgroundProps {
  variant?: "default" | "subtle" | "vibrant";
}

export function AnimatedBackground({ variant = "default" }: AnimatedBackgroundProps) {
  const orbs = [
    { size: 300, color: colors.orbTeal, x: -100, y: 50, duration: 8000 },
    { size: 250, color: colors.orbPurple, x: width - 100, y: 200, duration: 10000 },
    { size: 200, color: colors.orbCyan, x: 50, y: height - 300, duration: 7000 },
    { size: 180, color: colors.orbBlue, x: width - 150, y: height - 200, duration: 9000 },
  ];

  const subtleOrbs = [
    { size: 200, color: colors.orbTeal, x: -50, y: 100, duration: 12000 },
    { size: 150, color: colors.orbPurple, x: width - 80, y: 300, duration: 15000 },
  ];

  const activeOrbs = variant === "subtle" ? subtleOrbs : orbs;

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={[colors.background, colors.backgroundAlt, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      {activeOrbs.map((orb, index) => (
        <FloatingOrb
          key={index}
          size={orb.size}
          color={orb.color}
          initialX={orb.x}
          initialY={orb.y}
          duration={orb.duration}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    // Blur effect simulation
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 50,
  },
});

export default AnimatedBackground;
