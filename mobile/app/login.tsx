import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getProfileRole, getRoleDashboardPath } from "../lib/auth";
import { colors, typography, spacing, radius } from "../theme";
import { BackButton } from "../components/ui/BackButton";

function ConfigNeeded() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
      <View style={styles.card}>
        <Text style={styles.title}>Supabase not configured</Text>
        <Text style={styles.subtitle}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/.env
        </Text>
        <Text style={styles.hint}>Restart Expo after editing .env.</Text>
      </View>
    </View>
  );
}

export default function Login() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ message?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) return <ConfigNeeded />;
  const sb = supabase;

  const message =
    params.message === "confirm"
      ? "Check your email to confirm your account, then log in."
      : null;

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { data, error: signInError } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError("Invalid email or password.");
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("Something went wrong. Please try again.");
      return;
    }

    const role = await getProfileRole(sb, userId);
    const path = role ? getRoleDashboardPath(role) : "/";
    router.replace(path as "/" | "/d/venue" | "/d/personnel" | "/d/agency");
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton />
          
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>🛡️</Text>
            </View>
            <Text style={styles.logoText}>Shield</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Log in</Text>
            <Text style={styles.subtitle}>Use your Shield account to continue.</Text>

            {message && (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
              onPress={handleSubmit} 
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.submitBtnText}>Log in</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.link} onPress={() => router.push("/signup")}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkHighlight}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    ...typography.title,
    color: colors.text,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  messageBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  messageText: {
    ...typography.bodySmall,
    color: colors.accent,
  },
  errorBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  inputGroup: {
    marginTop: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    ...typography.body,
  },
  submitBtn: {
    marginTop: spacing.xl,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBtn,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  link: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  linkHighlight: {
    color: colors.accent,
    fontWeight: "500",
  },
});
