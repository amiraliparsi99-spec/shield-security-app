import React from "react";
import {
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { colors, radius, spacing } from "../../theme";

const CARD_WIDTH = Math.min(Dimensions.get("window").width * 0.72, 300);

type Props = {
  metadata: Record<string, unknown> | null | undefined;
  fallbackLabel?: string;
  isOwn?: boolean;
};

function parseCoords(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const lat =
    typeof metadata.latitude === "number"
      ? metadata.latitude
      : typeof metadata.lat === "number"
        ? metadata.lat
        : null;
  const lng =
    typeof metadata.longitude === "number"
      ? metadata.longitude
      : typeof metadata.lng === "number"
        ? metadata.lng
        : null;
  if (lat == null || lng == null) return null;
  return { lat, lng, label: typeof metadata.label === "string" ? metadata.label : undefined };
}

function openInMaps(lat: number, lng: number) {
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=Shared+Location`
      : `https://www.google.com/maps?q=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}

export function LocationMessageCard({ metadata, fallbackLabel, isOwn }: Props) {
  const coords = parseCoords(metadata);
  if (!coords) return null;

  const label = coords.label || fallbackLabel || "Shared location";

  return (
    <TouchableOpacity
      style={[styles.wrap, isOwn && styles.wrapOwn, { width: CARD_WIDTH }]}
      onPress={() => openInMaps(coords.lat, coords.lng)}
      activeOpacity={0.9}
    >
      <MapView
        style={styles.map}
        pointerEvents="none"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        initialRegion={{
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
      >
        <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }} />
      </MapView>
      <View style={styles.footer}>
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.btn}>Open →</Text>
      </View>
    </TouchableOpacity>
  );
}

export function hasLocationCoords(metadata: Record<string, unknown> | null | undefined): boolean {
  return parseCoords(metadata) != null;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#05080d",
  },
  wrapOwn: {
    borderColor: "rgba(0,199,162,0.35)",
  },
  map: {
    width: CARD_WIDTH,
    height: 110,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  pin: {
    fontSize: 14,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  btn: {
    fontSize: 12,
    color: "#00c7a2",
    fontWeight: "700",
  },
});
