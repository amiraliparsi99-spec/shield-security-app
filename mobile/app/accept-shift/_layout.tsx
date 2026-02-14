import { Stack } from "expo-router";
import { colors } from "../../theme";

export default function AcceptShiftLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        presentation: "fullScreenModal",
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
