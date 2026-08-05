import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radius, typography } from "../../theme";
import {
  type BookingLocationSource,
  resolveBookingLocation,
  openBookingDirections,
  copyBookingAddress,
} from "../../lib/bookingLocation";

type ShiftLocationCardProps = {
  booking: BookingLocationSource | null | undefined;
  /** "full" on shift detail; "compact" on job preview cards. */
  variant?: "full" | "compact";
};

export function ShiftLocationCard({
  booking,
  variant = "full",
}: ShiftLocationCardProps) {
  const loc = useMemo(() => resolveBookingLocation(booking), [booking]);
  const isCompact = variant === "compact";
  const missingAddress =
    !loc.hasStreetAddress &&
    loc.fullLine === "Address not available" &&
    !loc.hasCoordinates;

  const handleDirections = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await openBookingDirections(loc);
    if (!ok) {
      Alert.alert(
        "Could not open maps",
        "Copy the address and paste it into your maps app.",
      );
    }
  };

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await copyBookingAddress(loc);
    Alert.alert("Copied", "Address copied to clipboard.");
  };

  return (
    <View style={[styles.wrap, isCompact && styles.wrapCompact]}>
      <LinearGradient
        colors={["rgba(45,212,191,0.12)", "rgba(255,255,255,0.03)"]}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>📍 Where to go</Text>
          {loc.postcode ? (
            <View style={styles.postcodeBadge}>
              <Text style={styles.postcodeBadgeText}>{loc.postcode}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.siteName, isCompact && styles.siteNameCompact]}>
          {loc.siteName}
        </Text>

        {loc.venueName ? (
          <Text style={styles.venueName}>{loc.venueName}</Text>
        ) : null}

        {loc.hasCoordinates && !isCompact ? (
          <TouchableOpacity
            style={styles.mapWrap}
            onPress={handleDirections}
            activeOpacity={0.92}
          >
            <MapView
              style={styles.map}
              pointerEvents="none"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              initialRegion={{
                latitude: loc.latitude!,
                longitude: loc.longitude!,
                latitudeDelta: 0.006,
                longitudeDelta: 0.006,
              }}
            >
              <Marker
                coordinate={{
                  latitude: loc.latitude!,
                  longitude: loc.longitude!,
                }}
                title={loc.siteName}
              />
            </MapView>
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayText}>Tap map for directions</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.addressBlock}>
          {loc.addressLines.length > 0 ? (
            loc.addressLines.map((line, i) => (
              <Text
                key={`${line}-${i}`}
                style={[
                  styles.addressLine,
                  i === loc.addressLines.length - 1 &&
                    loc.postcode &&
                    line === loc.postcode &&
                    styles.postcodeLine,
                ]}
              >
                {line}
              </Text>
            ))
          ) : loc.fullLine !== "Address not available" ? (
            <Text style={styles.addressLine}>{loc.fullLine}</Text>
          ) : missingAddress ? (
            <Text style={styles.missingAddress}>
              Full street address not set for this site. Check the shift brief or contact
              your agency before travelling.
            </Text>
          ) : null}
        </View>

        {!isCompact ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleDirections}
              activeOpacity={0.88}
              disabled={!loc.directionsQuery}
            >
              <Text style={styles.actionBtnPrimaryText}>Get directions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCopy}
              activeOpacity={0.88}
            >
              <Text style={styles.actionBtnText}>Copy address</Text>
            </TouchableOpacity>
          </View>
        ) : loc.directionsQuery ? (
          <TouchableOpacity
            style={styles.compactDirections}
            onPress={handleDirections}
            activeOpacity={0.88}
          >
            <Text style={styles.compactDirectionsText}>Open in Maps →</Text>
          </TouchableOpacity>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  wrapCompact: {
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(45,212,191,0.35)",
    padding: spacing.md,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  postcodeBadge: {
    backgroundColor: "rgba(45,212,191,0.15)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(45,212,191,0.3)",
  },
  postcodeBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  siteName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 28,
  },
  siteNameCompact: {
    fontSize: 18,
    lineHeight: 24,
  },
  venueName: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  mapWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    height: 140,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 6,
    alignItems: "center",
  },
  mapOverlayText: {
    ...typography.caption,
    color: "#fff",
    fontWeight: "600",
  },
  addressBlock: {
    marginTop: spacing.xs,
    gap: 2,
  },
  addressLine: {
    ...typography.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  postcodeLine: {
    fontWeight: "800",
    color: colors.accent,
    fontSize: 17,
    marginTop: 2,
  },
  missingAddress: {
    ...typography.caption,
    color: colors.warning,
    lineHeight: 18,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  actionBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionBtnPrimaryText: {
    ...typography.body,
    color: "#04110f",
    fontWeight: "800",
  },
  actionBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  compactDirections: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  compactDirectionsText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
});
