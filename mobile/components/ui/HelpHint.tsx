/**
 * HelpHint
 * A small "?" trigger that opens a bottom sheet with a plain-language
 * explanation. Use it next to any jargon (geofence, Shield Score, check-in
 * radius, etc.) so non-technical users always have a way to understand a term.
 */

import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../theme";
import { BottomSheet, BottomSheetRef } from "./BottomSheet";

interface HelpHintProps {
  /** Short title for the term being explained. */
  label: string;
  /** Plain-language explanation. */
  text: string;
  /** Optional size of the trigger circle. Defaults to 18. */
  size?: number;
}

export function HelpHint({ label, text, size = 18 }: HelpHintProps) {
  const sheetRef = useRef<BottomSheetRef>(null);

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={`Help: ${label}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => sheetRef.current?.open()}
        style={[
          styles.trigger,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={[styles.triggerText, { fontSize: size * 0.6 }]}>?</Text>
      </TouchableOpacity>

      <BottomSheet ref={sheetRef} snapPoints={[0.35]}>
        <View style={styles.sheetContent}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.text}>{text}</Text>
          <TouchableOpacity
            style={styles.gotItButton}
            onPress={() => sheetRef.current?.close()}
          >
            <Text style={styles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  triggerText: {
    color: colors.textMuted,
    fontWeight: "700",
    lineHeight: undefined,
  },
  sheetContent: {
    paddingTop: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  gotItButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  gotItText: {
    ...typography.body,
    fontWeight: "600",
    color: "#000",
  },
});

export default HelpHint;
