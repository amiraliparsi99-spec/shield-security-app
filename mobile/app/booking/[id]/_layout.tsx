import { Stack } from "expo-router";

export default function BookingIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="pay" />
    </Stack>
  );
}
