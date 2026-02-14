import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "../../theme";

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
      <Text style={styles.arrow}>‹</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    alignSelf: "flex-start",
  },
  arrow: {
    fontSize: 28,
    color: colors.accent,
    marginRight: 2,
    marginTop: -2,
    fontWeight: "300",
  },
  label: {
    fontSize: 16,
    color: colors.accent,
  },
});
