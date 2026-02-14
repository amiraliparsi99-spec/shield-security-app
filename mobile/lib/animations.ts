/**
 * Premium Animation Library
 * Spring-based animations for a smooth, premium feel
 */

import { Animated, Easing } from "react-native";

// ============================================
// SPRING CONFIGURATIONS
// ============================================

export const SpringConfigs = {
  // Gentle spring - for subtle movements
  gentle: {
    tension: 170,
    friction: 26,
    useNativeDriver: true,
  },
  // Wobbly - for playful animations
  wobbly: {
    tension: 180,
    friction: 12,
    useNativeDriver: true,
  },
  // Stiff - for quick, snappy animations
  stiff: {
    tension: 400,
    friction: 30,
    useNativeDriver: true,
  },
  // Slow - for elegant transitions
  slow: {
    tension: 120,
    friction: 14,
    useNativeDriver: true,
  },
  // Bouncy - for celebratory animations
  bouncy: {
    tension: 300,
    friction: 10,
    useNativeDriver: true,
  },
};

// ============================================
// TIMING CONFIGURATIONS
// ============================================

export const TimingConfigs = {
  fast: {
    duration: 150,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  },
  normal: {
    duration: 300,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  },
  slow: {
    duration: 500,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  },
  bounce: {
    duration: 400,
    easing: Easing.bounce,
    useNativeDriver: true,
  },
};

// ============================================
// ANIMATION PRESETS
// ============================================

/**
 * Fade in animation
 */
export function fadeIn(
  value: Animated.Value,
  config: Partial<typeof TimingConfigs.normal> = {}
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue: 1,
    ...TimingConfigs.normal,
    ...config,
  });
}

/**
 * Fade out animation
 */
export function fadeOut(
  value: Animated.Value,
  config: Partial<typeof TimingConfigs.normal> = {}
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue: 0,
    ...TimingConfigs.normal,
    ...config,
  });
}

/**
 * Scale in with spring
 */
export function scaleIn(
  value: Animated.Value,
  config: Partial<typeof SpringConfigs.gentle> = {}
): Animated.CompositeAnimation {
  return Animated.spring(value, {
    toValue: 1,
    ...SpringConfigs.gentle,
    ...config,
  });
}

/**
 * Scale out
 */
export function scaleOut(
  value: Animated.Value,
  config: Partial<typeof TimingConfigs.fast> = {}
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue: 0,
    ...TimingConfigs.fast,
    ...config,
  });
}

/**
 * Slide in from bottom
 */
export function slideInFromBottom(
  value: Animated.Value,
  distance: number = 100,
  config: Partial<typeof SpringConfigs.gentle> = {}
): Animated.CompositeAnimation {
  value.setValue(distance);
  return Animated.spring(value, {
    toValue: 0,
    ...SpringConfigs.gentle,
    ...config,
  });
}

/**
 * Slide in from right
 */
export function slideInFromRight(
  value: Animated.Value,
  distance: number = 100,
  config: Partial<typeof SpringConfigs.gentle> = {}
): Animated.CompositeAnimation {
  value.setValue(distance);
  return Animated.spring(value, {
    toValue: 0,
    ...SpringConfigs.gentle,
    ...config,
  });
}

/**
 * Press down effect (for buttons/cards)
 */
export function pressDown(
  value: Animated.Value,
  scale: number = 0.97
): Animated.CompositeAnimation {
  return Animated.spring(value, {
    toValue: scale,
    ...SpringConfigs.stiff,
  });
}

/**
 * Press up effect (release)
 */
export function pressUp(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.spring(value, {
    toValue: 1,
    ...SpringConfigs.gentle,
  });
}

/**
 * Bounce animation (for celebrations)
 */
export function bounce(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.spring(value, {
      toValue: 1.2,
      ...SpringConfigs.bouncy,
    }),
    Animated.spring(value, {
      toValue: 1,
      ...SpringConfigs.gentle,
    }),
  ]);
}

/**
 * Shake animation (for errors)
 */
export function shake(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(value, { toValue: 10, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: -10, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: 10, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: -10, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: 0, duration: 50, useNativeDriver: true }),
  ]);
}

/**
 * Pulse animation (for attention)
 */
export function pulse(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1.1,
        duration: 800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 1,
        duration: 800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ])
  );
}

// ============================================
// STAGGERED ANIMATIONS
// ============================================

/**
 * Stagger animation for lists
 */
export function staggeredFadeIn(
  values: Animated.Value[],
  staggerDelay: number = 50
): Animated.CompositeAnimation {
  return Animated.stagger(
    staggerDelay,
    values.map((value) => fadeIn(value))
  );
}

/**
 * Stagger slide in from bottom
 */
export function staggeredSlideIn(
  translateValues: Animated.Value[],
  opacityValues: Animated.Value[],
  staggerDelay: number = 80
): Animated.CompositeAnimation {
  const animations = translateValues.map((translateY, index) => {
    translateY.setValue(30);
    opacityValues[index].setValue(0);
    return Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...SpringConfigs.gentle,
      }),
      fadeIn(opacityValues[index]),
    ]);
  });

  return Animated.stagger(staggerDelay, animations);
}

// ============================================
// SHIMMER EFFECT
// ============================================

/**
 * Create shimmer animation for skeleton loading
 */
export function createShimmer(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.timing(value, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );
}

/**
 * Get shimmer interpolation for translateX
 */
export function getShimmerInterpolation(
  value: Animated.Value,
  width: number
): Animated.AnimatedInterpolation<number> {
  return value.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });
}

// ============================================
// GESTURE ANIMATIONS
// ============================================

/**
 * Create swipe animation
 */
export function swipeAway(
  translateX: Animated.Value,
  direction: "left" | "right",
  screenWidth: number
): Animated.CompositeAnimation {
  const toValue = direction === "left" ? -screenWidth : screenWidth;
  return Animated.timing(translateX, {
    toValue,
    duration: 300,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  });
}

/**
 * Spring back to center
 */
export function springBack(value: Animated.Value): Animated.CompositeAnimation {
  return Animated.spring(value, {
    toValue: 0,
    ...SpringConfigs.gentle,
  });
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Create animated value with initial value
 */
export function createAnimatedValue(initialValue: number = 0): Animated.Value {
  return new Animated.Value(initialValue);
}

/**
 * Create array of animated values
 */
export function createAnimatedValues(count: number, initialValue: number = 0): Animated.Value[] {
  return Array.from({ length: count }, () => new Animated.Value(initialValue));
}

// ============================================
// INTERPOLATIONS
// ============================================

/**
 * Create rotation interpolation
 */
export function createRotation(
  value: Animated.Value,
  outputRange: string[] = ["0deg", "360deg"]
): Animated.AnimatedInterpolation<string> {
  return value.interpolate({
    inputRange: [0, 1],
    outputRange,
  });
}

/**
 * Create color interpolation
 */
export function createColorInterpolation(
  value: Animated.Value,
  fromColor: string,
  toColor: string
): Animated.AnimatedInterpolation<string> {
  return value.interpolate({
    inputRange: [0, 1],
    outputRange: [fromColor, toColor],
  });
}

// ============================================
// PARALLAX
// ============================================

/**
 * Create parallax effect interpolation
 */
export function createParallax(
  scrollY: Animated.Value,
  inputRange: number[],
  outputRange: number[]
): Animated.AnimatedInterpolation<number> {
  return scrollY.interpolate({
    inputRange,
    outputRange,
    extrapolate: "clamp",
  });
}

/**
 * Header collapse animation
 */
export function createHeaderCollapse(
  scrollY: Animated.Value,
  maxHeight: number,
  minHeight: number
): {
  height: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
} {
  const diffHeight = maxHeight - minHeight;
  
  return {
    height: scrollY.interpolate({
      inputRange: [0, diffHeight],
      outputRange: [maxHeight, minHeight],
      extrapolate: "clamp",
    }),
    opacity: scrollY.interpolate({
      inputRange: [0, diffHeight / 2, diffHeight],
      outputRange: [1, 0.5, 0],
      extrapolate: "clamp",
    }),
  };
}

// ============================================
// CELEBRATION ANIMATIONS
// ============================================

/**
 * Success celebration (checkmark + scale)
 */
export function celebrateSuccess(
  scaleValue: Animated.Value,
  opacityValue: Animated.Value
): Animated.CompositeAnimation {
  scaleValue.setValue(0);
  opacityValue.setValue(0);
  
  return Animated.parallel([
    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 1.3,
        ...SpringConfigs.bouncy,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        ...SpringConfigs.gentle,
      }),
    ]),
    fadeIn(opacityValue),
  ]);
}

/**
 * Confetti burst effect (multiple values)
 */
export function confettiBurst(
  values: Array<{
    translateY: Animated.Value;
    translateX: Animated.Value;
    rotate: Animated.Value;
    opacity: Animated.Value;
  }>,
  spread: number = 100
): Animated.CompositeAnimation {
  const animations = values.map((v, i) => {
    const angle = (i / values.length) * Math.PI * 2;
    const x = Math.cos(angle) * spread;
    const y = Math.sin(angle) * spread - 50;
    
    v.translateX.setValue(0);
    v.translateY.setValue(0);
    v.rotate.setValue(0);
    v.opacity.setValue(1);
    
    return Animated.parallel([
      Animated.timing(v.translateX, {
        toValue: x,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(v.translateY, {
        toValue: y,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(v.rotate, {
        toValue: Math.random() * 4 - 2,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(v.opacity, {
        toValue: 0,
        duration: 800,
        delay: 400,
        useNativeDriver: true,
      }),
    ]);
  });
  
  return Animated.parallel(animations);
}
