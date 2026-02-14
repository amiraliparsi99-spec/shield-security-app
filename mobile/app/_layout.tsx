import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../theme";
import { supabase } from "../lib/supabase";
import { CallProvider } from "../contexts/CallContext";
import { ShiftOfferProvider } from "../contexts/ShiftOfferContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { IncomingCallModal, ActiveCallScreen } from "../components/calling";
import { ShiftOfferPopup } from "../components/shifts/ShiftOfferPopup";
import { setupNotificationDeepLinks } from "../lib/push-notifications";
import { AnimatedOnboarding, useAnimatedOnboardingComplete } from "../components/onboarding/AnimatedOnboarding";

function AppContent() {
  const { isDark, colors: themeColors } = useTheme();
  const { isComplete, setIsComplete } = useAnimatedOnboardingComplete();

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        return;
      }
    });

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
    <CallProvider>
      <ShiftOfferProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
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
          <Stack.Screen name="login" options={{ title: "Log in" }} />
          <Stack.Screen name="signup" options={{ title: "Sign up" }} />
          <Stack.Screen name="verification" options={{ title: "Verification" }} />
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
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        {/* Global overlays */}
        <IncomingCallModal />
        <ActiveCallScreen />
        <ShiftOfferPopup />
      </ShiftOfferProvider>
    </CallProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
