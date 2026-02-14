import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

export default function ConfirmEmail() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email || "";
  
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) return;
    
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) throw error;
      setResendSuccess(true);
    } catch (err: any) {
      setResendError(err.message || "Failed to resend email");
    } finally {
      setIsResending(false);
    }
  };

  const openEmailApp = () => {
    // Try to open the default email app
    Linking.openURL("mailto:");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>Check your email</Text>
        
        <Text style={styles.description}>
          We've sent a verification link to
        </Text>
        
        {email && (
          <Text style={styles.email}>{email}</Text>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Click the link in the email to verify your account and get started. The link will expire in 24 hours.
          </Text>
        </View>

        {/* Open Email Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={openEmailApp}>
          <Text style={styles.primaryButtonText}>Open Email App</Text>
        </TouchableOpacity>

        {/* Resend Section */}
        <View style={styles.resendSection}>
          <Text style={styles.resendText}>
            Didn't receive the email? Check your spam folder or
          </Text>
          
          {resendSuccess && (
            <Text style={styles.successText}>✓ Verification email sent!</Text>
          )}

          {resendError && (
            <Text style={styles.errorText}>{resendError}</Text>
          )}

          <TouchableOpacity
            onPress={handleResend}
            disabled={isResending || !email}
            style={styles.resendButton}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.resendButtonText}>Resend verification email</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Alternative Actions */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>
              Already verified? <Text style={styles.linkHighlight}>Log in</Text>
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push("/signup")} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back to sign up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Help */}
      <View style={[styles.helpSection, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.helpText}>
          Having trouble? Contact support@shield.app
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
    textAlign: "center",
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },
  email: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  resendSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    width: "100%",
  },
  resendText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  successText: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  resendButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  resendButtonText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "500",
  },
  actions: {
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  linkHighlight: {
    color: colors.accent,
    fontWeight: "500",
  },
  backLink: {
    marginTop: spacing.sm,
  },
  backLinkText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  helpSection: {
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  helpText: {
    ...typography.caption,
    color: colors.textMuted,
    opacity: 0.6,
  },
});
