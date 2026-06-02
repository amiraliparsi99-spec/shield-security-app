/**
 * GuestShiftFeed — rotating preview of "live" shifts shown to signed-out users.
 *
 * Displays three sample shift cards stacked vertically. The freshest card is
 * labelled "JUST POSTED" with a pulsing live dot. Every ~5 seconds the data
 * advances by one so the top card swaps to a new shift, creating the feel of
 * a live job feed.
 *
 * Realism touches: distance from user, varied posted timestamps, venue
 * ratings, posted-by labels, spots-left badges, and a small subset of
 * confidential / anonymised cards that mirror real marketplace conventions.
 *
 * Every "Claim" / "Reveal" tap calls onClaim — typically the GuestGate's
 * signup CTA.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, gradients, radius, spacing, typography } from "../../theme";
import {
  SAMPLE_SHIFTS,
  type SampleShift,
  scatteredCoords,
  haversineMiles,
  formatDistanceLabel,
  formatPostedAgo,
  formatRate,
} from "../../data/sample-shifts";

const ROTATE_INTERVAL_MS = 5500;
const VISIBLE_COUNT = 3;

interface GuestShiftFeedProps {
  /** Tapped when the user hits "Claim shift" on any card. */
  onClaim: (shift: SampleShift) => void;
  /** City/area label shown in the header. Defaults to "London". */
  locationLabel?: string | null;
  /** User's resolved coordinates — enables real distance labels on cards. */
  userLocation?: { lat: number; lng: number } | null;
}

export function GuestShiftFeed({
  onClaim,
  locationLabel,
  userLocation,
}: GuestShiftFeedProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % SAMPLE_SHIFTS.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const cleanLabel = locationLabel?.trim() || null;
  const center = userLocation ?? null;

  type VisibleEntry = {
    shift: SampleShift;
    masterIndex: number;
  };

  const visible: VisibleEntry[] = [];
  for (let i = 0; i < VISIBLE_COUNT; i++) {
    const masterIndex = (offset + i) % SAMPLE_SHIFTS.length;
    visible.push({ shift: SAMPLE_SHIFTS[masterIndex], masterIndex });
  }

  const showSampleNote = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      "Live shifts preview",
      "These are example shifts to show you the kind of work Shield HQ posts. Sign up to see real, live jobs in your area — most guards in central locations see new shifts within minutes.",
      [{ text: "Got it" }]
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <LivePulseDot />
        <Text style={styles.headerLabel}>Live shifts near you</Text>
        <Text style={styles.headerLocation}>· {cleanLabel || "London"}</Text>
        <TouchableOpacity
          onPress={showSampleNote}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.infoBadge}
          accessibilityRole="button"
          accessibilityLabel="About these sample shifts"
        >
          <Text style={styles.infoBadgeText}>ⓘ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardStack}>
        {visible.map(({ shift, masterIndex }, idx) => (
          <ShiftCard
            key={`${shift.id}-${offset}-${idx}`}
            shift={shift}
            isFresh={idx === 0}
            cityOverride={cleanLabel}
            userLocation={center}
            masterIndex={masterIndex}
            onClaim={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {}
              );
              onClaim(shift);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ShiftCard({
  shift,
  isFresh,
  cityOverride,
  userLocation,
  masterIndex,
  onClaim,
}: {
  shift: SampleShift;
  isFresh: boolean;
  cityOverride: string | null;
  userLocation: { lat: number; lng: number } | null;
  masterIndex: number;
  onClaim: () => void;
}) {
  const fade = useRef(new Animated.Value(isFresh ? 0 : 1)).current;

  useEffect(() => {
    if (isFresh) {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    }
  }, [isFresh, fade, shift.id]);

  // Distance from the user, computed against the same scattered position the
  // map view places this shift at. Falls back to null if we don't have GPS.
  const distanceMiles = (() => {
    if (!userLocation) return null;
    const coords = scatteredCoords(masterIndex, userLocation);
    return haversineMiles(userLocation, coords);
  })();

  const distanceLabel =
    distanceMiles != null ? formatDistanceLabel(distanceMiles) : null;

  const venueLine = cityOverride
    ? cityOverride
    : `${shift.area}, ${shift.postcode}`;

  return (
    <Animated.View
      style={[
        styles.card,
        isFresh && styles.cardFresh,
        { opacity: isFresh ? fade : 0.92 },
      ]}
    >
      {isFresh && (
        <View style={styles.freshBadgeRow}>
          <View style={styles.freshDot} />
          <Text style={styles.freshBadgeText}>JUST POSTED</Text>
          <Text style={styles.freshPostedAt}>
            · {formatPostedAgo(shift.postedMinutesAgo)}
          </Text>
        </View>
      )}

      <View style={styles.cardTopRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardRole}>{shift.role}</Text>
          <View style={styles.venueLineRow}>
            {shift.confidential ? (
              <View style={styles.confidentialRow}>
                <Text style={styles.lockGlyph}>🔒</Text>
                <Text style={styles.confidentialVenue}>Confidential venue</Text>
              </View>
            ) : (
              <Text style={styles.cardVenue}>{shift.venue}</Text>
            )}
            <Text style={styles.cardArea}> · {venueLine}</Text>
          </View>

          {(shift.rating != null || shift.postedBy) && (
            <View style={styles.metaUnderRow}>
              {shift.rating != null && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={styles.ratingValue}>
                    {shift.rating.toFixed(1)}
                  </Text>
                  {shift.reviewCount != null && (
                    <Text style={styles.ratingCount}>
                      ({shift.reviewCount})
                    </Text>
                  )}
                </View>
              )}
              {shift.postedBy && (
                <Text style={styles.postedByLabel}>
                  · {shift.postedBy}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.rateBox}>
          <Text style={styles.rateValue}>{formatRate(shift.rate)}</Text>
          <Text style={styles.rateUnit}>/hr</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipIcon}>📅</Text>
          <Text style={styles.metaChipText}>{shift.dayLabel}</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipIcon}>⏰</Text>
          <Text style={styles.metaChipText}>{shift.timeLabel}</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{shift.hours} hrs</Text>
        </View>
        {distanceLabel && (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipIcon}>📍</Text>
            <Text style={styles.metaChipText}>{distanceLabel}</Text>
          </View>
        )}
        {shift.spotsLeft != null && shift.spotsLeft <= 3 && (
          <View style={[styles.metaChip, styles.spotsLowChip]}>
            <Text style={styles.spotsLowChipText}>
              {shift.spotsLeft} spot{shift.spotsLeft === 1 ? "" : "s"} left
            </Text>
          </View>
        )}
        {shift.spotsLeft != null && shift.spotsLeft > 3 && (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              {shift.spotsLeft} spots
            </Text>
          </View>
        )}
        {shift.isUrgent && !shift.spotsLeft && (
          <View style={[styles.metaChip, styles.urgentChip]}>
            <Text style={styles.urgentChipText}>URGENT</Text>
          </View>
        )}
        {!isFresh && (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              {formatPostedAgo(shift.postedMinutesAgo)}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onClaim}
        style={styles.claimWrap}
      >
        {shift.confidential ? (
          <View style={[styles.claimBtn, styles.claimBtnSecondary]}>
            <Text style={styles.claimBtnSecondaryText}>
              Sign up to reveal venue
            </Text>
            <Text style={styles.claimBtnSecondaryArrow}>→</Text>
          </View>
        ) : isFresh ? (
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.claimBtn}
          >
            <Text style={styles.claimBtnText}>Claim shift</Text>
            <Text style={styles.claimBtnArrow}>→</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.claimBtn, styles.claimBtnGhost]}>
            <Text style={styles.claimBtnGhostText}>View details</Text>
            <Text style={styles.claimBtnGhostArrow}>›</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function LivePulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.9,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[styles.pulseRing, { opacity, transform: [{ scale }] }]}
      />
      <View style={styles.pulseDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  headerLabel: {
    ...typography.label,
    color: colors.text,
    letterSpacing: 0.4,
  },
  headerLocation: {
    ...typography.label,
    color: colors.textMuted,
    flex: 1,
  },
  infoBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBadgeText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 14,
  },
  pulseWrap: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.live,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },

  cardStack: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardFresh: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderActive,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  freshBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  freshDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  freshBadgeText: {
    ...typography.captionMuted,
    color: colors.accent,
    letterSpacing: 1,
    fontWeight: "700",
  },
  freshPostedAt: {
    ...typography.caption,
    color: colors.textMuted,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardRole: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: 2,
  },
  venueLineRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardVenue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cardArea: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  confidentialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockGlyph: {
    fontSize: 12,
  },
  confidentialVenue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: "italic",
  },

  metaUnderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingStar: {
    fontSize: 11,
    color: colors.warningLight,
  },
  ratingValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  ratingCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  postedByLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },

  rateBox: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
  },
  rateValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: -0.3,
  },
  rateUnit: {
    fontSize: 11,
    color: colors.accent,
    marginLeft: 2,
    fontWeight: "600",
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
  },
  metaChipIcon: {
    fontSize: 11,
  },
  metaChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  urgentChip: {
    backgroundColor: colors.warningSoft,
    borderColor: "rgba(245,158,11,0.35)",
  },
  urgentChipText: {
    ...typography.captionMuted,
    color: colors.warningLight,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  spotsLowChip: {
    backgroundColor: colors.errorSoft,
    borderColor: "rgba(239,68,68,0.35)",
  },
  spotsLowChipText: {
    ...typography.captionMuted,
    color: colors.errorLight,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  claimWrap: {
    alignSelf: "stretch",
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  claimBtnText: {
    ...typography.body,
    color: "#000",
    fontWeight: "700",
  },
  claimBtnArrow: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
  },
  claimBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  claimBtnGhostText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  claimBtnGhostArrow: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  claimBtnSecondary: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
  },
  claimBtnSecondaryText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
  },
  claimBtnSecondaryArrow: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: "700",
  },
});

export default GuestShiftFeed;
