/**
 * Animation Hooks
 * Reusable hooks for common animation patterns
 */

import { useRef, useEffect, useCallback } from "react";
import { Animated, PanResponder, Dimensions, GestureResponderEvent, PanResponderGestureState } from "react-native";
import {
  fadeIn,
  scaleIn,
  slideInFromBottom,
  pressDown,
  pressUp,
  shake,
  SpringConfigs,
  createAnimatedValue,
  createAnimatedValues,
  staggeredSlideIn,
} from "../lib/animations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Hook for fade-in animation on mount
 */
export function useFadeIn(delay: number = 0) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      fadeIn(opacity).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return opacity;
}

/**
 * Hook for scale-in animation on mount
 */
export function useScaleIn(delay: number = 0) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      scaleIn(scale).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return scale;
}

/**
 * Hook for slide-in animation from bottom
 */
export function useSlideIn(delay: number = 0, distance: number = 50) {
  const translateY = useRef(new Animated.Value(distance)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        slideInFromBottom(translateY, distance),
        fadeIn(opacity),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return { translateY, opacity };
}

/**
 * Hook for staggered list animation
 */
export function useStaggeredList(itemCount: number, staggerDelay: number = 80) {
  const translateYValues = useRef(createAnimatedValues(itemCount, 30)).current;
  const opacityValues = useRef(createAnimatedValues(itemCount, 0)).current;

  useEffect(() => {
    if (itemCount > 0) {
      staggeredSlideIn(translateYValues, opacityValues, staggerDelay).start();
    }
  }, [itemCount, staggerDelay]);

  return { translateYValues, opacityValues };
}

/**
 * Hook for press animation (buttons, cards)
 */
export function usePressAnimation(scale: number = 0.97) {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    pressDown(scaleValue, scale).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    pressUp(scaleValue).start();
  }, []);

  return {
    scale: scaleValue,
    onPressIn,
    onPressOut,
    style: { transform: [{ scale: scaleValue }] },
  };
}

/**
 * Hook for shake animation (errors)
 */
export function useShakeAnimation() {
  const translateX = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    shake(translateX).start();
  }, []);

  return {
    translateX,
    triggerShake,
    style: { transform: [{ translateX }] },
  };
}

/**
 * Hook for swipeable card
 */
export function useSwipeableCard(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold: number = SCREEN_WIDTH * 0.3
) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-10deg", "0deg", "10deg"],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > threshold && onSwipeRight) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(onSwipeRight);
        } else if (gestureState.dx < -threshold && onSwipeLeft) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(onSwipeLeft);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            ...SpringConfigs.gentle,
          }).start();
        }
      },
    })
  ).current;

  const reset = useCallback(() => {
    translateX.setValue(0);
  }, []);

  return {
    translateX,
    rotate,
    panHandlers: panResponder.panHandlers,
    reset,
    style: {
      transform: [{ translateX }, { rotate }],
    },
  };
}

/**
 * Hook for bottom sheet drag
 */
export function useBottomSheetDrag(
  snapPoints: number[],
  initialIndex: number = 0,
  onClose?: () => void
) {
  const translateY = useRef(new Animated.Value(snapPoints[initialIndex])).current;
  const currentIndex = useRef(initialIndex);

  const snapToIndex = useCallback((index: number) => {
    if (index < 0 || index >= snapPoints.length) return;
    currentIndex.current = index;
    Animated.spring(translateY, {
      toValue: snapPoints[index],
      ...SpringConfigs.gentle,
    }).start();
  }, [snapPoints]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = snapPoints[currentIndex.current] + gestureState.dy;
        if (newValue >= 0) {
          translateY.setValue(newValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = snapPoints[currentIndex.current] + gestureState.dy;
        const velocity = gestureState.vy;

        // Find closest snap point
        let closestIndex = 0;
        let minDistance = Infinity;

        snapPoints.forEach((point, index) => {
          const distance = Math.abs(currentY - point);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        });

        // Adjust based on velocity
        if (velocity > 0.5 && closestIndex < snapPoints.length - 1) {
          closestIndex++;
        } else if (velocity < -0.5 && closestIndex > 0) {
          closestIndex--;
        }

        // Check if should close
        if (closestIndex === snapPoints.length - 1 && onClose) {
          onClose();
        } else {
          snapToIndex(closestIndex);
        }
      },
    })
  ).current;

  return {
    translateY,
    panHandlers: panResponder.panHandlers,
    snapToIndex,
  };
}

/**
 * Hook for parallax header
 */
export function useParallaxHeader(maxHeight: number, minHeight: number) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const diffHeight = maxHeight - minHeight;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, diffHeight],
    outputRange: [maxHeight, minHeight],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, diffHeight / 2, diffHeight],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, diffHeight / 2, diffHeight],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  const imageTranslate = scrollY.interpolate({
    inputRange: [0, diffHeight],
    outputRange: [0, -diffHeight / 3],
    extrapolate: "clamp",
  });

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  return {
    scrollY,
    headerHeight,
    headerOpacity,
    titleOpacity,
    imageTranslate,
    onScroll,
  };
}

/**
 * Hook for shimmer loading effect
 */
export function useShimmer() {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const getShimmerStyle = (width: number) => ({
    transform: [
      {
        translateX: shimmerValue.interpolate({
          inputRange: [0, 1],
          outputRange: [-width, width],
        }),
      },
    ],
  });

  return { shimmerValue, getShimmerStyle };
}

/**
 * Hook for pulse animation
 */
export function usePulse() {
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return { scale: scaleValue };
}

/**
 * Hook for tab indicator animation
 */
export function useTabIndicator(tabCount: number, tabWidth: number) {
  const indicatorX = useRef(new Animated.Value(0)).current;

  const animateToTab = useCallback((index: number) => {
    Animated.spring(indicatorX, {
      toValue: index * tabWidth,
      ...SpringConfigs.stiff,
    }).start();
  }, [tabWidth]);

  return { indicatorX, animateToTab };
}
