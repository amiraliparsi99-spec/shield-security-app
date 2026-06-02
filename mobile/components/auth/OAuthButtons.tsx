/**
 * OAuthButtons — drop-in "Continue with Apple / Google" CTAs.
 *
 * Used on the login screen and the signup role-chooser. Calls into
 * lib/oauth.ts which handles the native flow + Supabase exchange. After a
 * successful sign-in the parent decides where to navigate (login → home,
 * signup → role completion). For new OAuth users we surface that via
 * onSuccess({ isNewUser: true }) so the parent can route to oauth-complete.
 *
 * Design notes:
 *  - Both buttons are pill-shaped white CTAs with a brand glyph + "Continue
 *    with X" label. The Google G is rendered as an inline 4-colour SVG so
 *    it matches the official mark exactly.
 *  - Apple is HIG-compliant: official apple glyph, "Continue with Apple"
 *    text, generous padding. We render it ourselves (instead of the native
 *    AppleAuthenticationButton) so it visually matches the Google button —
 *    the underlying signInWithApple flow still uses Apple's native sheet.
 *  - The divider sits ABOVE the buttons because in our screens these CTAs
 *    are placed at the BOTTOM, after the email/password form (or role list).
 */

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radius, spacing, typography } from "../../theme";
import {
  hasCompletedProfile,
  signInWithApple,
  signInWithGoogle,
  type OAuthResult,
} from "../../lib/oauth";

type Provider = "apple" | "google";

type Props = {
  /** Optional label for the divider above the buttons. Defaults to "or". */
  dividerLabel?: string;
  /** Hide the divider entirely (useful when the parent provides one). */
  hideDivider?: boolean;
  /** Called after a successful sign-in (or sign-up). Parent handles routing. */
  onSuccess: (info: {
    userId: string;
    isNewUser: boolean;
    displayName: string | null;
    profileExists: boolean;
  }) => void;
  /**
   * Called if the OAuth flow returned an error (not just a user-cancellation).
   * Use to render an inline message; we don't show our own Alert by default.
   */
  onError?: (message: string) => void;
};

/** Official 4-colour Google G mark. */
function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </Svg>
  );
}

/** Apple logo glyph (filled). */
function AppleLogo({ size = 18, color = "#000" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

export function OAuthButtons({
  dividerLabel = "or",
  hideDivider = false,
  onSuccess,
  onError,
}: Props) {
  const [busy, setBusy] = useState<Provider | null>(null);

  const handleResult = async (provider: Provider, result: OAuthResult) => {
    if (!result.ok) {
      if (result.cancelled) return;
      if (onError) onError(result.error);
      else Alert.alert("Sign-in failed", result.error);
      return;
    }
    const userId = result.session.user.id;
    const profileExists = await hasCompletedProfile(userId);
    onSuccess({
      userId,
      isNewUser: result.isNewUser || !profileExists,
      displayName: result.displayName,
      profileExists,
    });
  };

  const onApple = async () => {
    if (busy) return;
    setBusy("apple");
    try {
      const result = await signInWithApple();
      await handleResult("apple", result);
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setBusy("google");
    try {
      const result = await signInWithGoogle();
      await handleResult("google", result);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {!hideDivider && (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{dividerLabel}</Text>
          <View style={styles.dividerLine} />
        </View>
      )}

      {Platform.OS === "ios" && (
        <TouchableOpacity
          style={[styles.btn, busy === "apple" && styles.btnBusy]}
          onPress={onApple}
          disabled={busy !== null}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          {busy === "apple" ? (
            <ActivityIndicator color="#0c0d10" />
          ) : (
            <View style={styles.btnInner}>
              <View style={styles.iconSlot}>
                <AppleLogo size={18} color="#0c0d10" />
              </View>
              <Text style={styles.btnText}>Continue with Apple</Text>
              <View style={styles.iconSlot} />
            </View>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.btn, busy === "google" && styles.btnBusy]}
        onPress={onGoogle}
        disabled={busy !== null}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        {busy === "google" ? (
          <ActivityIndicator color="#0c0d10" />
        ) : (
          <View style={styles.btnInner}>
            <View style={styles.iconSlot}>
              <GoogleGLogo size={20} />
            </View>
            <Text style={styles.btnText}>Continue with Google</Text>
            <View style={styles.iconSlot} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const BTN_HEIGHT = 54;
const ICON_SLOT = 28;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.glassBorder,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 11,
    fontWeight: "600",
  },
  btn: {
    height: BTN_HEIGHT,
    borderRadius: BTN_HEIGHT / 2,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  btnInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconSlot: {
    width: ICON_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#0c0d10",
    letterSpacing: 0.1,
  },
  btnBusy: { opacity: 0.7 },
});
