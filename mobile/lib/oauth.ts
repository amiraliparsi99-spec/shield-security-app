/**
 * Native Apple + Google sign-in for the Shield mobile app.
 *
 * Both flows return an OIDC ID token from the OS-level provider, then exchange
 * it for a Supabase session via supabase.auth.signInWithIdToken(). That keeps
 * everything inside Supabase Auth (no second user table to reconcile) and lets
 * us continue to use auth.uid() in RLS exactly as before.
 *
 * UX rules baked in:
 *   - Apple is required on iOS by App Store policy whenever Google is present.
 *   - Google needs both an iOS Client ID (for the iOS app) and a Web Client ID
 *     (used as the OIDC audience and registered with Supabase).
 *   - We deliberately let Supabase handle "same-email" linking on its end so a
 *     guard who first signed up with email/password can later use Google with
 *     the same address without creating a duplicate user.
 */

import * as AppleAuthentication from "expo-apple-authentication";
import type { Session } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/** Lazy-load Google Sign-In so app boot doesn't require the native module. */
function loadGoogleSignInModule() {
  try {
    return require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let googleConfigured = false;
function ensureGoogleConfigured(GoogleSignin: NonNullable<ReturnType<typeof loadGoogleSignInModule>>["GoogleSignin"]) {
  if (googleConfigured) return;
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error(
      "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID for iOS) in mobile/.env, then rebuild the app."
    );
  }
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["profile", "email"],
  });
  googleConfigured = true;
}

export type OAuthResult =
  | { ok: true; session: Session; isNewUser: boolean; displayName: string | null }
  | { ok: false; cancelled?: boolean; error: string };

/**
 * Trigger native Sign in with Apple, then exchange the identity token for a
 * Supabase session. iOS-only (Apple sign-in is not available on Android in
 * this app).
 */
export async function signInWithApple(): Promise<OAuthResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, error: "Sign in with Apple is only available on iOS." };
  }
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return {
        ok: false,
        error:
          "Sign in with Apple isn't available on this device. Please update iOS or use another sign-in method.",
      };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, error: "Apple did not return an identity token. Please try again." };
    }

    // Apple only ever sends the user's full name on the FIRST sign-in; we
    // capture it now and persist into our profile later.
    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(" ")
          .trim() || null
      : null;

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });

    if (error || !data.session) {
      return { ok: false, error: error?.message || "Could not sign in with Apple." };
    }

    const isNewUser = isFreshlyCreatedUser(data.session);

    // Persist the Apple-provided full name on first sign-in so signup-complete
    // can prefill the form. Best-effort — never block on this.
    if (fullName) {
      try {
        await supabase.auth.updateUser({ data: { display_name: fullName } });
      } catch {
        // ignore
      }
    }

    return {
      ok: true,
      session: data.session,
      isNewUser,
      displayName: fullName ?? extractDisplayName(data.session),
    };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    // ERR_REQUEST_CANCELED on iOS = user dismissed the system sheet.
    if (e?.code === "ERR_REQUEST_CANCELED" || /cancel/i.test(e?.message || "")) {
      return { ok: false, cancelled: true, error: "Cancelled" };
    }
    return { ok: false, error: e?.message || "Something went wrong with Apple sign-in." };
  }
}

/**
 * Trigger native Google sign-in, then exchange the ID token for a Supabase
 * session. Works on both iOS and Android.
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }

  const googleMod = loadGoogleSignInModule();
  if (!googleMod) {
    return {
      ok: false,
      error:
        "Google sign-in isn't available in this build. Install the Shield dev app (npm run ios) or use email / Apple sign-in.",
    };
  }
  const { GoogleSignin, isErrorWithCode: isGoogleErrorWithCode, statusCodes: googleStatusCodes } =
    googleMod;

  try {
    ensureGoogleConfigured(GoogleSignin);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    // Newer versions of the SDK wrap the payload in `{ type, data }`; older
    // versions return the user directly. Normalize.
    const payload =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (userInfo as any)?.data ?? (userInfo as unknown as { idToken?: string; user?: { name?: string } });
    const idToken: string | undefined = payload?.idToken;
    if (!idToken) {
      return { ok: false, error: "Google did not return an ID token. Please try again." };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error || !data.session) {
      return { ok: false, error: error?.message || "Could not sign in with Google." };
    }

    const fullName: string | null =
      payload?.user?.name ?? extractDisplayName(data.session);
    const isNewUser = isFreshlyCreatedUser(data.session);

    return { ok: true, session: data.session, isNewUser, displayName: fullName };
  } catch (err: unknown) {
    if (isGoogleErrorWithCode(err)) {
      switch (err.code) {
        case googleStatusCodes.SIGN_IN_CANCELLED:
          return { ok: false, cancelled: true, error: "Cancelled" };
        case googleStatusCodes.IN_PROGRESS:
          return { ok: false, error: "Sign-in already in progress." };
        case googleStatusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { ok: false, error: "Google Play services are unavailable on this device." };
        default:
          return { ok: false, error: err.message || "Google sign-in failed." };
      }
    }
    const e = err as { message?: string };
    return { ok: false, error: e?.message || "Something went wrong with Google sign-in." };
  }
}

/**
 * Best-effort: detect whether a session belongs to a freshly created auth user.
 * We compare created_at and last_sign_in_at — for brand-new users these are
 * within a few seconds of each other.
 */
function isFreshlyCreatedUser(session: Session): boolean {
  const u = session.user;
  if (!u?.created_at) return false;
  const created = new Date(u.created_at).getTime();
  const lastSignIn = u.last_sign_in_at
    ? new Date(u.last_sign_in_at).getTime()
    : created;
  return Math.abs(lastSignIn - created) < 10_000; // within 10s
}

function extractDisplayName(session: Session): string | null {
  const u = session.user;
  const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    meta.display_name,
    meta.full_name,
    meta.name,
    u?.email?.split("@")[0],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

export { hasCompletedProfile } from "./oauth-profile";
