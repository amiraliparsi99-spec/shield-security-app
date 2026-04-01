/**
 * LiveIndicator - Pulsing live/active indicator
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, typography, spacing, radius } from "../../theme";

interface LiveIndicatorProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
  showLabel?: boolean;
}

export function LiveIndicator({
  label = "LIVE",
  size = "md",
  color = colors.live,
  showLabel = true,
}: LiveIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  const getDotSize = () => {
    switch (size) {
      case "sm":
        return 6;
      case "lg":
        return 12;
      default:
        return 8;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return 9;
      case "lg":
        return 12;
      default:
        return 10;
    }
  };

  const dotSize = getDotSize();

  return (
    <View style={styles.container}>
      <View style={styles.dotContainer}>
        <Animated.View
          style={[
            styles.pulse,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { fontSize: getFontSize(), color }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dotContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
  },
  dot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    fontWeight: "700",
    letterSpacing: 1,
  },
});

export default LiveIndicator;
