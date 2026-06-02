import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, spacing, typography } from "../../theme";

interface BackButtonProps {
  label?: string;
  onPress?: () => void;
  style?: any;
}

export function BackButton({ label = "Back", onPress, style }: BackButtonProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.label}>← {label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    alignSelf: "flex-start",
  },
  label: {
    ...typography.body,
    color: colors.accent,
  },
});
