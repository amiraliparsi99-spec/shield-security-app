/**
 * Premium Bottom Sheet Component
 * Gesture-driven bottom sheet with snap points and backdrop blur
 */

import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "../../theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface BottomSheetRef {
  open: () => void;
  close: () => void;
  snapTo: (index: number) => void;
}

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: number[]; // Percentages of screen height (e.g., [0.3, 0.6, 0.9])
  initialIndex?: number;
  onClose?: () => void;
  onChange?: (index: number) => void;
  enableBackdropDismiss?: boolean;
  enableHandlePanGesture?: boolean;
  handleComponent?: React.ReactNode;
  backdropOpacity?: number;
}

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      children,
      snapPoints = [0.5],
      initialIndex = 0,
      onClose,
      onChange,
      enableBackdropDismiss = true,
      enableHandlePanGesture = true,
      handleComponent,
      backdropOpacity = 0.5,
    },
    ref
  ) => {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacityAnim = useRef(new Animated.Value(0)).current;
    const currentIndexRef = useRef(initialIndex);
    const [isVisible, setIsVisible] = React.useState(false);

    // Convert snap points to pixel values
    const snapPointsPixels = snapPoints.map((p) => SCREEN_HEIGHT * (1 - p));

    const snapToIndex = useCallback(
      (index: number, animated = true) => {
        if (index < 0 || index >= snapPoints.length) return;

        const toValue = snapPointsPixels[index];
        currentIndexRef.current = index;

        if (animated) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.spring(translateY, {
            toValue,
            tension: 100,
            friction: 12,
            useNativeDriver: true,
          }).start();
        } else {
          translateY.setValue(toValue);
        }

        onChange?.(index);
      },
      [snapPoints, snapPointsPixels, onChange]
    );

    const open = useCallback(() => {
      setIsVisible(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: snapPointsPixels[initialIndex],
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: backdropOpacity,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [initialIndex, snapPointsPixels, backdropOpacity]);

    const close = useCallback(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsVisible(false);
        onClose?.();
      });
    }, [onClose]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      open,
      close,
      snapTo: snapToIndex,
    }));

    // Handle back button on Android
    useEffect(() => {
      if (!isVisible) return;

      const handleBackPress = () => {
        close();
        return true;
      };

      BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      return () => BackHandler.removeEventListener("hardwareBackPress", handleBackPress);
    }, [isVisible, close]);

    // Pan responder for drag gesture
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => enableHandlePanGesture,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          enableHandlePanGesture && Math.abs(gestureState.dy) > 10,
        onPanResponderMove: (_, gestureState) => {
          const currentY = snapPointsPixels[currentIndexRef.current];
          const newY = Math.max(0, currentY + gestureState.dy);
          translateY.setValue(newY);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentY = snapPointsPixels[currentIndexRef.current] + gestureState.dy;
          const velocity = gestureState.vy;

          // Find closest snap point
          let closestIndex = 0;
          let minDistance = Infinity;

          snapPointsPixels.forEach((point, index) => {
            const distance = Math.abs(currentY - point);
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = index;
            }
          });

          // Adjust based on velocity (fast swipe)
          if (velocity > 0.5) {
            // Swiping down
            if (closestIndex < snapPoints.length - 1) {
              closestIndex++;
            } else {
              // Close if at last snap point and swiping down fast
              close();
              return;
            }
          } else if (velocity < -0.5) {
            // Swiping up
            if (closestIndex > 0) {
              closestIndex--;
            }
          }

          // Check if should close (dragged below lowest snap point)
          if (currentY > SCREEN_HEIGHT * 0.8) {
            close();
            return;
          }

          snapToIndex(closestIndex);
        },
      })
    ).current;

    if (!isVisible) return null;

    return (
      <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
        <View style={styles.container}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={enableBackdropDismiss ? close : undefined}>
            <Animated.View
              style={[
                styles.backdrop,
                { opacity: backdropOpacityAnim },
              ]}
            >
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            </Animated.View>
          </TouchableWithoutFeedback>

          {/* Sheet */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardAvoid}
          >
            <Animated.View
              style={[
                styles.sheet,
                { transform: [{ translateY }] },
              ]}
            >
              {/* Handle */}
              <View {...panResponder.panHandlers} style={styles.handleContainer}>
                {handleComponent || (
                  <View style={styles.handle}>
                    <View style={styles.handleBar} />
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={styles.content}>{children}</View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }
);

// Quick action bottom sheet
export function QuickActionsSheet({
  visible,
  onClose,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  actions: Array<{
    icon: string;
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }>;
}) {
  const sheetRef = useRef<BottomSheetRef>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.open();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  return (
    <BottomSheet ref={sheetRef} snapPoints={[0.4]} onClose={onClose}>
      <View style={styles.actionsContainer}>
        {actions.map((action, index) => (
          <TouchableWithoutFeedback
            key={index}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              action.onPress();
              onClose();
            }}
          >
            <View style={styles.actionItem}>
              <View style={[styles.actionIcon, action.destructive && styles.actionIconDestructive]}>
                <Animated.Text style={styles.actionEmoji}>{action.icon}</Animated.Text>
              </View>
              <Animated.Text
                style={[styles.actionLabel, action.destructive && styles.actionLabelDestructive]}
              >
                {action.label}
              </Animated.Text>
            </View>
          </TouchableWithoutFeedback>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    minHeight: 100,
    maxHeight: SCREEN_HEIGHT * 0.95,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  handle: {
    padding: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.textMuted,
    borderRadius: 2,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  actionsContainer: {
    paddingTop: spacing.sm,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  actionIconDestructive: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  actionLabelDestructive: {
    color: colors.error,
  },
});

export default BottomSheet;
