import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { colors } from "../../theme";

/** Redirect /chat to the Messages tab. */
export default function ChatIndex() {
  useEffect(() => {
    router.replace("/messages");
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
