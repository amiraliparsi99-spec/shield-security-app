import { Stack } from "expo-router";
import { colors } from "../../../theme";

export default function ExploreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="venue/[id]" />
      <Stack.Screen name="personnel/[id]" />
      <Stack.Screen name="agency/[id]" />
    </Stack>
  );
}
