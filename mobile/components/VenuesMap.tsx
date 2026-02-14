import { useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import { StyleSheet, View } from "react-native";
import type { Venue } from "../data/dashboard";
import { colors, radius } from "../theme";

interface VenuesMapProps {
  venues: Venue[];
  center: { lat: number; lng: number };
}

export function VenuesMap({ venues, center }: VenuesMapProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        mapType="standard"
        showsUserLocation={false}
      >
        {venues.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            title={v.name}
            description={`${v.openRequests.length} open request${v.openRequests.length !== 1 ? "s" : ""} · ${v.openRequests.reduce((s, r) => s + r.guardsCount, 0)} guards needed`}
            onPress={() => router.push(`/venue/${v.id}`)}
            onCalloutPress={() => router.push(`/venue/${v.id}`)}
            pinColor={colors.primaryBtn}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: "100%",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: {
    flex: 1,
    width: "100%",
  },
});
