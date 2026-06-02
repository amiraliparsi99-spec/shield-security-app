/**
 * AnimatedBackground — Shield HQ tactical grid background.
 *
 * Replaces the previous "floating orbs" visual with a security-operations-centre
 * aesthetic that matches the company standard:
 *
 *   1) Deep dark vertical gradient as the base.
 *   2) Static SVG dot grid (radar / mission-control feel).
 *   3) Soft accent glow from the top-right corner that gently pulses.
 *   4) Optional faint Shield watermark behind the grid (brand-forward variant).
 *
 * Three variants:
 *   - "subtle"  — fainter grid, no corner glow (use for guest splashes / read-only).
 *   - "default" — standard grid + single teal corner glow.
 *   - "vibrant" — denser grid + dual corner glows (teal top-right, purple bottom-left).
 *
 * Orthogonal `watermark` prop toggles the large Shield silhouette behind the grid.
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";
import Svg, {
  Defs,
  Pattern,
  Circle,
  Rect,
  RadialGradient,
  Stop,
  Path,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme";

const { width, height } = Dimensions.get("window");

// Heraldic shield silhouette in a 100x112 viewBox.
// Flat-ish top with subtle curve, straight sides, rounded point at bottom.
const SHIELD_PATH =
  "M 50 4 C 70 6 82 8 92 12 L 92 50 C 92 78 75 98 50 108 C 25 98 8 78 8 50 L 8 12 C 18 8 30 6 50 4 Z";

interface AnimatedBackgroundProps {
  variant?: "default" | "subtle" | "vibrant";
  /** Render a large faint Shield silhouette behind the grid. */
  watermark?: boolean;
}

export function AnimatedBackground({
  variant = "default",
  watermark = false,
}: AnimatedBackgroundProps) {
  // Grid styling differs per variant
  const gridSpacing = variant === "vibrant" ? 22 : 24;
  const gridOpacity =
    variant === "subtle" ? 0.04 : variant === "vibrant" ? 0.075 : 0.06;

  // Soft pulse on the corner glow(s) — very slow, almost imperceptible
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (variant === "subtle") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 3800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 3800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [variant, pulse]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* 1) Base dark gradient */}
      <LinearGradient
        colors={["#0a0d14", "#070910", "#050608"]}
        style={StyleSheet.absoluteFill}
      />

      {/* 2) Optional Shield watermark — sits behind the grid */}
      {watermark && (() => {
        const shieldWidth = Math.min(width * 0.62, 320);
        const shieldHeight = shieldWidth * 1.12;
        const shieldLeft = (width - shieldWidth) / 2;
        const shieldTop = (height - shieldHeight) / 2 - height * 0.04;
        return (
          <Svg
            width={shieldWidth}
            height={shieldHeight}
            viewBox="0 0 100 112"
            style={{
              position: "absolute",
              left: shieldLeft,
              top: shieldTop,
            }}
            pointerEvents="none"
          >
            <Defs>
              <SvgLinearGradient
                id="shieldFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.07} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0.02} />
              </SvgLinearGradient>
            </Defs>
            <Path
              d={SHIELD_PATH}
              fill="url(#shieldFill)"
              stroke={colors.accent}
              strokeOpacity={0.18}
              strokeWidth={0.6}
            />
          </Svg>
        );
      })()}

      {/* 3) Static dot grid */}
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id="dotGrid"
            patternUnits="userSpaceOnUse"
            width={gridSpacing}
            height={gridSpacing}
          >
            <Circle
              cx={1}
              cy={1}
              r={1}
              fill={`rgba(255,255,255,${gridOpacity})`}
            />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#dotGrid)" />
      </Svg>

      {/* 4) Corner accent glow(s) — pulsing */}
      {variant !== "subtle" && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: pulse }]}
          pointerEvents="none"
        >
          <Svg
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Defs>
              <RadialGradient
                id="cornerGlowTR"
                cx={width}
                cy={0}
                rx={width * 0.85}
                ry={height * 0.55}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
                <Stop
                  offset="0.55"
                  stopColor={colors.accent}
                  stopOpacity={0.06}
                />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
              {variant === "vibrant" && (
                <RadialGradient
                  id="cornerGlowBL"
                  cx={0}
                  cy={height}
                  rx={width * 0.7}
                  ry={height * 0.45}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop
                    offset="0"
                    stopColor={colors.secondary}
                    stopOpacity={0.18}
                  />
                  <Stop
                    offset="1"
                    stopColor={colors.secondary}
                    stopOpacity={0}
                  />
                </RadialGradient>
              )}
            </Defs>
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="url(#cornerGlowTR)"
            />
            {variant === "vibrant" && (
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="url(#cornerGlowBL)"
              />
            )}
          </Svg>
        </Animated.View>
      )}

      {/* 5) Bottom vignette — tightens focus to centre content */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.35)"]}
        locations={[0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#050608",
  },
});

export default AnimatedBackground;
