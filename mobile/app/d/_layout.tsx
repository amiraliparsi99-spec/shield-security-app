import { Stack, router } from "expo-router";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

function BackButton() {
  return (
    <TouchableOpacity 
      style={styles.backButton} 
      onPress={() => router.replace("/(tabs)")}
    >
      <Text style={styles.backButtonText}>← Back</Text>
    </TouchableOpacity>
  );
}

export default function DLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="venue" 
        options={{ 
          title: "Your venue",
          headerLeft: () => <BackButton />,
        }} 
      />
      <Stack.Screen 
        name="personnel" 
        options={{ 
          title: "My dashboard",
          headerLeft: () => <BackButton />,
        }} 
      />
      <Stack.Screen 
        name="agency" 
        options={{ 
          title: "Agency dashboard",
          headerLeft: () => <BackButton />,
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "500",
  },
});
