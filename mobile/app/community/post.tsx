import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { createCommunityPost } from "../../lib/community";
import { colors, typography, spacing, radius } from "../../theme";
import { BackButton } from "../../components/ui/BackButton";

export default function NewPostScreen() {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePost() {
    const text = content.trim();
    if (!text) {
      Alert.alert("New post", "Write something to share.");
      return;
    }
    setLoading(true);
    const r = await createCommunityPost(supabase, text);
    setLoading(false);
    if (r.error) {
      Alert.alert("New post", r.error);
      return;
    }
    router.back();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }]}>
      <BackButton />
      
      <Text style={styles.title}>Share your experience</Text>
      <Text style={styles.subtitle}>Post to the security community. Tips, shifts, or industry thoughts.</Text>
      <TextInput
        style={styles.input}
        value={content}
        onChangeText={setContent}
        placeholder="What’s on your mind? E.g. a tip from your last shift, a certification that helped, or an insight from the industry…"
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={6}
        maxLength={2000}
        editable={!loading}
      />
      <Text style={styles.hint}>{content.length} / 2000</Text>
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handlePost}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.btnText}>Post</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: 6 },
  input: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.text,
    minHeight: 140,
    textAlignVertical: "top",
  },
  hint: { ...typography.captionMuted, color: colors.textMuted, marginTop: spacing.xs },
  btn: {
    marginTop: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryBtn,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { ...typography.body, fontWeight: "600", color: colors.text },
});
