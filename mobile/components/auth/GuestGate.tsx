/**
 * GuestGate — Airbnb-style "log in to continue" splash.
 *
 * Wrap a screen with this so it stays browseable until the user tries to
 * use a logged-in feature. If there's no Supabase session, we render a
 * branded sign-up / log-in splash with feature-specific copy. Otherwise
 * we render the children unchanged.
 *
 * Subscribes to Supabase `onAuthStateChange` so that signing in inside a
 * modal flow swaps the splash for the real screen without a manual reload.
 */

import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { colors, gradients, radius, spacing, typography } from "../../theme";
import { AnimatedBackground } from "../ui/AnimatedBackground";
import { GuestShiftFeed } from "../guest/GuestShiftFeed";
import { useGuestLocation } from "../../lib/guestLocation";

/** Features where we replace the bullet list with a rotating live-shifts feed. */
const FEED_FEATURES = new Set<GuestGateFeature>(["jobs", "shifts"]);

export type GuestGateFeature =
  | "messages"
  | "payments"
  | "training"
  | "cv"
  | "trophies"
  | "documents"
  | "availability"
  | "reviews"
  | "stats"
  | "profile"
  | "shifts"
  | "jobs"
  | "account";

type FeatureCopy = {
  icon: string;
  title: string;
  subtitle: string;
  bullets: string[];
};

const FEATURE_COPY: Record<GuestGateFeature, FeatureCopy> = {
  messages: {
    icon: "💬",
    title: "Sign in to see your messages",
    subtitle: "Every booking has a Mission Control chat with the venue and the rest of the team.",
    bullets: [
      "Coordinate with venues before the shift",
      "Voice + group calls with your team",
      "Push alerts for new shift offers",
    ],
  },
  payments: {
    icon: "💷",
    title: "Sign in to see your earnings",
    subtitle: "Track payouts, fees and your wallet balance — all in one place.",
    bullets: [
      "Instant or standard withdrawal options",
      "Stripe Connect for automatic payouts",
      "Full transaction history",
    ],
  },
  training: {
    icon: "🎓",
    title: "Sign in to start training",
    subtitle: "Take certified Shield modules, earn badges, and climb from Bronze to Shield Elite.",
    bullets: [
      "Save your quiz progress and badges",
      "Stack points toward higher tiers",
      "Show certifications on your digital CV",
    ],
  },
  cv: {
    icon: "📋",
    title: "Sign in to view your CV",
    subtitle: "Your verified Shield CV — work history, ratings, and certifications in one place.",
    bullets: [
      "Auto-built from your completed shifts",
      "Verified ratings from venues",
      "Share with new venues in one tap",
    ],
  },
  trophies: {
    icon: "🏆",
    title: "Sign in to see your trophies",
    subtitle: "Unlock trophies as you complete shifts, training, and earn 5-star reviews.",
    bullets: [
      "100+ trophies to collect",
      "Auto-awarded as you work",
      "Boost your Shield Score",
    ],
  },
  documents: {
    icon: "📄",
    title: "Sign in to manage documents",
    subtitle: "Upload your SIA badge, DBS check and right-to-work documents securely.",
    bullets: [
      "Verified once, used everywhere",
      "Reminders before they expire",
      "Encrypted storage",
    ],
  },
  availability: {
    icon: "📅",
    title: "Sign in to set your availability",
    subtitle: "Tell us which days you can work and we'll only send you matching offers.",
    bullets: [
      "Pick exact dates and shift windows",
      "Block holidays in seconds",
      "Get matched to nearby jobs first",
    ],
  },
  reviews: {
    icon: "⭐",
    title: "Sign in to see your reviews",
    subtitle: "Read what venues and teams have said about your work.",
    bullets: [
      "Verified post-shift ratings",
      "Feed your Shield Score",
      "Reply or flag unfair reviews",
    ],
  },
  stats: {
    icon: "📊",
    title: "Sign in to see your stats",
    subtitle: "Your Shield Score, earnings and streaks — all in real time.",
    bullets: [
      "Earnings and hours by month",
      "Shield Score progression",
      "Compare yourself to the network",
    ],
  },
  profile: {
    icon: "✏️",
    title: "Sign in to edit your profile",
    subtitle: "Add your photo, rate, role and bio so venues can find you.",
    bullets: [
      "Show up in venue searches",
      "Set your hourly rate",
      "Highlight your specialities",
    ],
  },
  shifts: {
    icon: "🛡️",
    title: "Sign in to see your shifts",
    subtitle: "Once you're verified, accepted shifts appear here with everything you need to clock in.",
    bullets: [
      "Live route + check-in countdown",
      "Pre-shift attendance prompts",
      "Real-time GPS to the venue",
    ],
  },
  jobs: {
    icon: "🔍",
    title: "Sign in to claim shifts",
    subtitle: "Browse open shifts near you and claim the ones that match your availability.",
    bullets: [
      "First-come, first-served claims",
      "Filter by city, role, and rate",
      "Get push alerts for fresh jobs",
    ],
  },
  account: {
    icon: "🛡️",
    title: "Welcome to Shield HQ",
    subtitle: "Sign up or log in to unlock your dashboard, shifts and payouts.",
    bullets: [
      "Your shifts, earnings and ratings",
      "Manage availability, documents and CV",
      "Stay verified with SIA, DBS and right-to-work",
    ],
  },
};

type GuestGateProps = {
  feature: GuestGateFeature;
  /** Override default copy (rarely needed). */
  title?: string;
  subtitle?: string;
  /** Where Sign Up / Log In should send the user back to after auth. */
  redirectAfter?: string;
  /** Show a "Keep browsing" link that pops back to the previous screen. */
  showBackLink?: boolean;
  children: React.ReactNode;
};

export function GuestGate({
  feature,
  title,
  subtitle,
  redirectAfter,
  showBackLink,
  children,
}: GuestGateProps) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setHasSession(false);
      return;
    }
    const sb = supabase;

    sb.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session?.user?.id);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasSession(!!session?.user?.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (hasSession === null) {
    return (
      <View style={loadingStyles.wrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (hasSession) {
    return <>{children}</>;
  }

  return (
    <GuestSplash
      feature={feature}
      title={title}
      subtitle={subtitle}
      redirectAfter={redirectAfter}
      showBackLink={showBackLink}
    />
  );
}

function GuestSplash({
  feature,
  title,
  subtitle,
  redirectAfter,
  showBackLink,
}: Omit<GuestGateProps, "children">) {
  const insets = useSafeAreaInsets();
  const copy = FEATURE_COPY[feature];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const goSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(redirectAfter ? `/signup?next=${encodeURIComponent(redirectAfter)}` : "/signup");
  };

  const goLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(redirectAfter ? `/login?next=${encodeURIComponent(redirectAfter)}` : "/login");
  };

  const goBack = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/explore");
  };

  return (
    <View style={splashStyles.container}>
      <AnimatedBackground variant="default" />

      <ScrollView
        contentContainerStyle={[
          splashStyles.scrollContent,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Hero icon — smaller when a live shifts feed is taking the stage */}
          <View
            style={[
              splashStyles.iconWrap,
              FEED_FEATURES.has(feature) && splashStyles.iconWrapCompact,
            ]}
          >
            <LinearGradient
              colors={gradients.accentSoft}
              style={[
                splashStyles.iconBubble,
                FEED_FEATURES.has(feature) && splashStyles.iconBubbleCompact,
              ]}
            >
              <Text
                style={[
                  splashStyles.iconEmoji,
                  FEED_FEATURES.has(feature) && splashStyles.iconEmojiCompact,
                ]}
              >
                {copy.icon}
              </Text>
            </LinearGradient>
          </View>

          {/* Headline */}
          <Text style={splashStyles.title}>{title ?? copy.title}</Text>
          <Text style={splashStyles.subtitle}>{subtitle ?? copy.subtitle}</Text>

          {FEED_FEATURES.has(feature) ? (
            /* Live shifts preview — taps trigger signup */
            <FeedWithGeo onClaim={goSignup} />
          ) : (
            /* Value bullets */
            <View style={splashStyles.bullets}>
              {copy.bullets.map((b) => (
                <View key={b} style={splashStyles.bulletRow}>
                  <View style={splashStyles.bulletDot}>
                    <Text style={splashStyles.bulletCheck}>✓</Text>
                  </View>
                  <Text style={splashStyles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {/* CTAs */}
          <View style={splashStyles.ctaWrap}>
            <TouchableOpacity activeOpacity={0.85} onPress={goSignup}>
              <LinearGradient colors={gradients.accent} style={splashStyles.primaryBtn}>
                <Text style={splashStyles.primaryBtnText}>Sign up — it's free</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={splashStyles.secondaryBtn}
              activeOpacity={0.75}
              onPress={goLogin}
            >
              <Text style={splashStyles.secondaryBtnText}>I already have an account</Text>
            </TouchableOpacity>

            {showBackLink !== false && (
              <TouchableOpacity
                style={splashStyles.backLink}
                onPress={goBack}
                activeOpacity={0.7}
              >
                <Text style={splashStyles.backLinkText}>Keep browsing</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Reassurance */}
          <Text style={splashStyles.legal}>
            Sign-up takes under a minute. By continuing you agree to Shield HQ's Terms and Privacy
            Policy.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** Pulls the guest's coarse location so the feed can label the city correctly. */
function FeedWithGeo({ onClaim }: { onClaim: () => void }) {
  const location = useGuestLocation();
  return (
    <GuestShiftFeed
      onClaim={onClaim}
      locationLabel={location?.label}
      userLocation={
        location ? { lat: location.lat, lng: location.lng } : null
      }
    />
  );
}

const loadingStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  iconWrapCompact: {
    marginBottom: spacing.md,
  },
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
  },
  iconBubbleCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  iconEmoji: {
    fontSize: 44,
  },
  iconEmojiCompact: {
    fontSize: 30,
  },
  title: {
    ...typography.display,
    color: colors.text,
    fontSize: 28,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xl,
  },
  bullets: {
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  bulletDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletCheck: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  bulletText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  ctaWrap: {
    gap: spacing.md,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryBtnText: {
    ...typography.body,
    color: "#000",
    fontWeight: "700",
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  secondaryBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  backLink: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  backLinkText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    lineHeight: 16,
  },
});
