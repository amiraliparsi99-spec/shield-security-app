import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { colors } from "../theme";
import { supabase } from "../lib/supabase";
import { CallProvider } from "../contexts/CallContext";
import { ShiftOfferProvider } from "../contexts/ShiftOfferContext";
import { TabBarProvider } from "../contexts/TabBarContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { UnreadMessagesProvider } from "../contexts/UnreadMessagesContext";
import { IncomingCallModal, ActiveCallScreen } from "../components/calling";
import { ShiftOfferPopup } from "../components/shifts/ShiftOfferPopup";
import { ShiftAttendanceConfirmPopup } from "../components/shifts/ShiftAttendanceConfirmPopup";
import { PreShiftTracker } from "../components/tracking/PreShiftTracker";
import { setupNotificationDeepLinks } from "../lib/push-notifications";
import { AnimatedOnboarding, useAnimatedOnboardingComplete } from "../components/onboarding/AnimatedOnboarding";
import { useAuthStore } from "../stores";
import { hasCompletedProfile } from "../lib/oauth-profile";

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

function AppContent() {
  const { isDark, colors: themeColors } = useTheme();
  const { isComplete, setIsComplete } = useAnimatedOnboardingComplete();
  const { loadAuth, clear: clearAuth } = useAuthStore();
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        clearAuth();
        return;
      }
      if (!session?.user) return;
      loadAuth();

      // OAuth users who quit before completing the role-picker step land back
      // here on next launch — they have a session but no profile row, so we
      // route them to /signup/oauth-complete. We deliberately DELAY the check
      // by ~2s: email/password signup also fires SIGNED_IN immediately, and
      // its profile insert happens a few hundred ms later. We don't want to
      // fight the explicit nav that those flows do.
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;

      const userId = session.user.id;
      setTimeout(async () => {
        try {
          // If the user is currently on a login/signup/auth flow, leave them
          // alone — they're either still onboarding or about to be navigated
          // explicitly by the screen that triggered the sign-in.
          const seg0 = segmentsRef.current[0] ?? "";
          if (
            seg0 === "login" ||
            seg0 === "signup" ||
            seg0 === "verification"
          ) {
            return;
          }
          const completed = await hasCompletedProfile(userId);
          if (!completed) {
            try {
              router.replace("/signup/oauth-complete");
            } catch {
              // router may not be ready on initial mount — best-effort
            }
          }
        } catch (e) {
          console.warn("[Auth] profile check failed:", e);
        }
      }, 2000);
    });
    loadAuth();

    sb.auth.getSession().catch(async (error) => {
      if (error?.message?.includes("Refresh Token") || error?.message?.includes("Invalid")) {
        console.log("Invalid refresh token detected, clearing session...");
        try {
          await sb.auth.signOut();
        } catch (signOutError) {
          const AsyncStorage = require("@react-native-async-storage/async-storage").default;
          await AsyncStorage.removeItem("supabase.auth.token");
        }
      }
    });

    // Set up push notification deep links (shift offers, bookings, etc.)
    const deepLinkSub = setupNotificationDeepLinks((path) => {
      try {
        router.push(path as any);
      } catch (e) {
        console.warn("Deep link navigation failed:", e);
      }
    });

    return () => {
      subscription.unsubscribe();
      deepLinkSub.remove();
    };
  }, []);

  // Show animated onboarding if not complete
  if (isComplete === false) {
    return <AnimatedOnboarding onComplete={() => setIsComplete(true)} />;
  }

  // Loading state
  if (isComplete === null) {
    return null;
  }

  return (
    <TabBarProvider>
      <UnreadMessagesProvider>
        <CallProvider>
          <ShiftOfferProvider>
          <StatusBar style="light" />
          <Stack
          screenOptions={{
            headerStyle: { backgroundColor: themeColors.background },
            headerTintColor: themeColors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: themeColors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="d" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="verification" options={{ headerShown: false }} />
          <Stack.Screen name="venue/[id]" options={{ title: "Venue" }} />
          <Stack.Screen name="personnel/[id]" options={{ title: "Profile" }} />
          <Stack.Screen name="agency/[id]" options={{ title: "Agency" }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="community/post" options={{ title: "New post" }} />
          <Stack.Screen name="availability" options={{ headerShown: false }} />
          <Stack.Screen name="analytics" options={{ headerShown: false }} />
          <Stack.Screen name="booking" options={{ headerShown: false }} />
          <Stack.Screen name="staff" options={{ headerShown: false }} />
          <Stack.Screen name="call" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="shift-tracker" options={{ headerShown: false }} />
          <Stack.Screen name="marketplace" options={{ headerShown: false }} />
          <Stack.Screen name="accept-shift" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="documents" options={{ headerShown: false }} />
          <Stack.Screen name="ai-assistant" options={{ headerShown: false }} />
          <Stack.Screen name="reviews" options={{ headerShown: false }} />
          <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
          <Stack.Screen name="booking-manage" options={{ headerShown: false }} />
          <Stack.Screen name="insurance" options={{ headerShown: false }} />
          <Stack.Screen name="referrals" options={{ headerShown: false }} />
          <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
          <Stack.Screen name="calendar" options={{ headerShown: false }} />
          <Stack.Screen name="cv" options={{ headerShown: false }} />
          <Stack.Screen name="stats" options={{ headerShown: false }} />
          <Stack.Screen name="jobs" options={{ headerShown: false }} />
          <Stack.Screen name="job/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="training/index" options={{ headerShown: false }} />
          <Stack.Screen name="training/[courseId]" options={{ headerShown: false }} />
          <Stack.Screen name="trophies" options={{ headerShown: false }} />
          <Stack.Screen name="shift/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="upcoming-shifts" options={{ headerShown: false }} />
          <Stack.Screen name="new-conversation" options={{ headerShown: false }} />
          <Stack.Screen name="venue-settings" options={{ headerShown: false }} />
          <Stack.Screen name="preferred-staff" options={{ headerShown: false }} />
          <Stack.Screen name="spend-dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
            {/* Global overlays */}
            <IncomingCallModal />
            <ActiveCallScreen />
            <ShiftOfferPopup />
            <ShiftAttendanceConfirmPopup />
            <PreShiftTracker />
          </ShiftOfferProvider>
        </CallProvider>
      </UnreadMessagesProvider>
    </TabBarProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ThemeProvider>
          <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.app.shield.mobile"
          >
            <AppContent />
          </StripeProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
