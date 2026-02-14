import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { getOrCreateConversation } from "../../lib/chat";
import { colors, typography, spacing } from "../../theme";

export default function ChatStart() {
  const { other } = useLocalSearchParams<{ other?: string }>();
  const otherStr = typeof other === "string" ? other : Array.isArray(other) ? other[0] : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!otherStr) {
      router.replace("/messages");
      return;
    }
    if (!supabase) {
      setError("Not connected");
      setLoading(false);
      return;
    }
    getOrCreateConversation(supabase, otherStr).then((r) => {
      setLoading(false);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.id) router.replace(`/chat/${r.id}`);
    });
  }, [otherStr]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errText}>{error}</Text>
        <TouchableOpacity onPress={() => router.replace("/messages")} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Back to messages</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
  errText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  backBtn: { marginTop: spacing.xl, padding: spacing.md },
  backBtnText: { ...typography.titleCard, color: colors.accent },
});
