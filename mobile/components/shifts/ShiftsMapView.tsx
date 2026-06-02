/**
 * ShiftsMapView — explore-tab map mode.
 *
 * Renders an interactive map showing the user's current location plus a pin
 * per available shift. Tapping a pin reveals a floating preview card with
 * the venue, pay, and a "Claim" CTA. Auto-fits the camera to include the
 * user + every shift on first render and whenever the shift set changes.
 *
 * The component is purely presentational — claim/navigation actions are
 * delegated up via callbacks so the parent owns auth/verification gates.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadows, spacing, typography } from "../../theme";

export interface MapShiftJob {
  booking_id: string;
  role: string;
  event_name: string;
  venue_name: string;
  venue_city: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  positions_available: number;
  shift_ids: string[];
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  jobs: MapShiftJob[];
  /** Default centre when we have no jobs and no user fix yet. */
  fallbackCenter?: { lat: number; lng: number };
  /**
   * Pixels to keep clear at the bottom of the map (e.g. for the tab bar).
   * The recentre button and preview card both float above this offset.
   */
  bottomInset?: number;
  onPressClaim: (job: MapShiftJob) => void;
  onPressDetails: (job: MapShiftJob) => void;
}

const DEFAULT_CENTER = { lat: 52.4862, lng: -1.8904 }; // Birmingham

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function payFor(job: MapShiftJob) {
  const hours =
    (new Date(job.scheduled_end).getTime() - new Date(job.scheduled_start).getTime()) /
    3600000;
  return Math.round(job.hourly_rate * hours);
}

/** Pulsing teal pin shown on the map for each shift. */
function ShiftPin({
  selected,
  positions,
}: {
  selected: boolean;
  positions: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.5] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={pinStyles.container}>
      <Animated.View
        style={[
          pinStyles.ring,
          {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <View style={[pinStyles.dot, selected && pinStyles.dotSelected]}>
        <Text style={pinStyles.icon}>🛡️</Text>
      </View>
      {positions > 1 && (
        <View style={pinStyles.badge}>
          <Text style={pinStyles.badgeText}>{positions}</Text>
        </View>
      )}
    </View>
  );
}

const pinStyles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,212,170,0.4)",
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dotSelected: {
    transform: [{ scale: 1.15 }],
    borderColor: "#fff",
    backgroundColor: colors.accentLight,
  },
  icon: { fontSize: 14 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#0c0d10",
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: colors.accent },
});

export function ShiftsMapView({
  jobs,
  fallbackCenter,
  bottomInset = 0,
  onPressClaim,
  onPressDetails,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fittedOnceRef = useRef(false);

  const jobsWithCoords = useMemo(
    () =>
      jobs.filter(
        (j): j is MapShiftJob & { latitude: number; longitude: number } =>
          typeof j.latitude === "number" && typeof j.longitude === "number"
      ),
    [jobs]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          if (!cancelled) setPermGranted(true);
          const last = await Location.getLastKnownPositionAsync();
          if (last && !cancelled) {
            setUserLoc({ lat: last.coords.latitude, lng: last.coords.longitude });
          }
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null);
          if (fresh && !cancelled) {
            setUserLoc({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
          }
        } else if (status === "undetermined") {
          const req = await Location.requestForegroundPermissionsAsync();
          if (!cancelled) setPermGranted(req.status === "granted");
          if (req.status === "granted") {
            const fix = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }).catch(() => null);
            if (fix && !cancelled) {
              setUserLoc({ lat: fix.coords.latitude, lng: fix.coords.longitude });
            }
          }
        } else {
          if (!cancelled) setPermGranted(false);
        }
      } catch {
        if (!cancelled) setPermGranted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fit camera to user + all shifts the first time we have data, and again
  // whenever the set of jobs meaningfully changes.
  useEffect(() => {
    if (!mapRef.current) return;
    const points: { latitude: number; longitude: number }[] = [];
    if (userLoc) points.push({ latitude: userLoc.lat, longitude: userLoc.lng });
    for (const j of jobsWithCoords) {
      points.push({ latitude: j.latitude, longitude: j.longitude });
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      const region: Region = {
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      mapRef.current.animateToRegion(region, 600);
      fittedOnceRef.current = true;
      return;
    }
    mapRef.current.fitToCoordinates(points, {
      edgePadding: {
        top: 100,
        right: 60,
        bottom: Math.max(280, bottomInset + 220),
        left: 60,
      },
      animated: fittedOnceRef.current,
    });
    fittedOnceRef.current = true;
  }, [userLoc, jobsWithCoords, bottomInset]);

  const initialRegion: Region = useMemo(() => {
    const c = userLoc || fallbackCenter || DEFAULT_CENTER;
    const lat = "lat" in c ? c.lat : (c as any).latitude;
    const lng = "lng" in c ? c.lng : (c as any).longitude;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [userLoc, fallbackCenter]);

  const recentre = useCallback(() => {
    if (!mapRef.current) return;
    if (userLoc) {
      mapRef.current.animateToRegion(
        {
          latitude: userLoc.lat,
          longitude: userLoc.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        500
      );
    } else if (jobsWithCoords.length > 0) {
      mapRef.current.fitToCoordinates(
        jobsWithCoords.map((j) => ({ latitude: j.latitude, longitude: j.longitude })),
        {
          edgePadding: {
            top: 100,
            right: 60,
            bottom: Math.max(280, bottomInset + 220),
            left: 60,
          },
          animated: true,
        }
      );
    }
  }, [userLoc, jobsWithCoords, bottomInset]);

  const selected = useMemo(
    () => jobs.find((j) => `${j.booking_id}-${j.role}` === selectedKey) || null,
    [jobs, selectedKey]
  );

  const missingCount = jobs.length - jobsWithCoords.length;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        mapType="standard"
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        userInterfaceStyle="dark"
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={() => setSelectedKey(null)}
      >
        {jobsWithCoords.map((job) => {
          const key = `${job.booking_id}-${job.role}`;
          return (
            <Marker
              key={key}
              coordinate={{ latitude: job.latitude, longitude: job.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === "ios"}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedKey(key);
              }}
            >
              <ShiftPin selected={selectedKey === key} positions={job.positions_available} />
            </Marker>
          );
        })}
      </MapView>

      {/* Top status pill */}
      <View style={styles.topPill} pointerEvents="box-none">
        <View style={styles.pill}>
          <View style={styles.liveDot} />
          <Text style={styles.pillText}>
            {jobsWithCoords.length} shift{jobsWithCoords.length === 1 ? "" : "s"} on map
            {missingCount > 0 ? ` · ${missingCount} unmapped` : ""}
          </Text>
        </View>
      </View>

      {/* Floating recentre button — sits above the preview card and tab bar. */}
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: bottomInset + (selected ? 220 : 24) },
        ]}
        onPress={recentre}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Recentre map on my location"
      >
        <Text style={styles.fabIcon}>◎</Text>
      </TouchableOpacity>

      {permGranted === false && (
        <View style={styles.permBanner} pointerEvents="box-none">
          <View style={styles.permCard}>
            <Text style={styles.permTitle}>Turn on location to see your position</Text>
            <Text style={styles.permBody}>
              Enable location access in Settings to see how far each shift is from you.
            </Text>
          </View>
        </View>
      )}

      {permGranted === null && !userLoc && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {selected && (
        <View
          style={[styles.previewWrap, { bottom: bottomInset + 16 }]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={["rgba(12,13,16,0.95)", "rgba(12,13,16,0.98)"]}
            style={styles.preview}
          >
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewVenue} numberOfLines={1}>
                  {selected.venue_name}
                  {selected.venue_city ? ` · ${selected.venue_city}` : ""}
                </Text>
                <Text style={styles.previewEvent} numberOfLines={1}>
                  {selected.event_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedKey(null)}
                hitSlop={10}
                style={styles.closeBtn}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewMeta}>
              <View style={styles.metaChip}>
                <Text style={styles.metaText}>{formatDate(selected.scheduled_start)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaText}>
                  {formatTime(selected.scheduled_start)} – {formatTime(selected.scheduled_end)}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaText}>{selected.role}</Text>
              </View>
              {selected.positions_available > 1 && (
                <View style={[styles.metaChip, styles.metaChipAccent]}>
                  <Text style={[styles.metaText, styles.metaTextAccent]}>
                    {selected.positions_available} spots
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.previewFooter}>
              <View>
                <Text style={styles.previewPay}>£{payFor(selected)}</Text>
                <Text style={styles.previewRate}>£{selected.hourly_rate}/hr</Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => onPressDetails(selected)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.detailsBtnText}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.claimBtn}
                  onPress={() => onPressClaim(selected)}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={gradients.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.claimGradient}
                  >
                    <Text style={styles.claimText}>Claim</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {jobs.length > 0 && jobsWithCoords.length === 0 && (
        <View
          style={[styles.emptyOverlay, { bottom: bottomInset + 16 }]}
          pointerEvents="box-none"
        >
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Locations unavailable</Text>
            <Text style={styles.emptyBody}>
              We couldn't pinpoint these shifts on the map yet. Switch to list view to see them.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", overflow: "hidden" },
  topPill: {
    position: "absolute",
    top: spacing.sm,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(12,13,16,0.85)",
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...shadows.subtle,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  pillText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
    fontSize: 12,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(12,13,16,0.92)",
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.subtle,
  },
  fabIcon: {
    fontSize: 22,
    color: colors.accent,
    fontWeight: "700",
  },
  permBanner: {
    position: "absolute",
    top: spacing.xl + 32,
    left: spacing.md,
    right: spacing.md,
    alignItems: "center",
  },
  permCard: {
    backgroundColor: "rgba(12,13,16,0.92)",
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  permTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  permBody: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,10,15,0.35)",
  },
  previewWrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
  },
  preview: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    padding: spacing.lg,
    ...shadows.glowSm,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  previewVenue: {
    ...typography.titleCard,
    color: colors.text,
    fontSize: 16,
  },
  previewEvent: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  previewMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  metaChip: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipAccent: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(0,212,170,0.35)",
  },
  metaText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 12,
  },
  metaTextAccent: { color: colors.accentLight, fontWeight: "700" },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  previewPay: {
    ...typography.title,
    color: colors.accentLight,
    fontWeight: "800",
    fontSize: 22,
  },
  previewRate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailsBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  detailsBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
  claimBtn: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  claimGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  claimText: {
    ...typography.body,
    color: "#03120f",
    fontWeight: "800",
    fontSize: 14,
  },
  emptyOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
  },
  emptyBox: {
    backgroundColor: "rgba(12,13,16,0.92)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  emptyBody: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
});
