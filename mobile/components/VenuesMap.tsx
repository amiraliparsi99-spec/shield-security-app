import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated as RNAnimated, Easing, Platform } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

interface VenuesMapProps {
  center: { lat: number; lng: number };
  venues?: any[];
  showGuards?: boolean;
}

// Fixed guard positions on Birmingham streets/urban areas only
const GUARD_POSITIONS: { lat: number; lng: number }[] = [
  // City centre / New Street area
  { lat: 52.4779, lng: -1.8985 },
  { lat: 52.4800, lng: -1.8935 },
  // Broad Street
  { lat: 52.4762, lng: -1.9050 },
  { lat: 52.4785, lng: -1.9080 },
  // Digbeth / Custard Factory
  { lat: 52.4745, lng: -1.8820 },
  { lat: 52.4730, lng: -1.8775 },
  // Jewellery Quarter
  { lat: 52.4880, lng: -1.9020 },
  { lat: 52.4905, lng: -1.8960 },
  // Eastside / Millennium Point
  { lat: 52.4835, lng: -1.8840 },
  // Brindleyplace / Canal
  { lat: 52.4810, lng: -1.9000 },
  // Colmore Row / business district
  { lat: 52.4820, lng: -1.8950 },
  // Chinese Quarter
  { lat: 52.4770, lng: -1.8930 },
  // Aston / inner city north
  { lat: 52.4930, lng: -1.8870 },
  { lat: 52.4960, lng: -1.8910 },
  // Highgate / Balsall Heath
  { lat: 52.4680, lng: -1.8900 },
  // Edgbaston / Five Ways
  { lat: 52.4730, lng: -1.9120 },
  // Ladywood
  { lat: 52.4850, lng: -1.9100 },
  // Hockley
  { lat: 52.4895, lng: -1.8980 },
  // Bordesley Green direction
  { lat: 52.4760, lng: -1.8700 },
  // Moseley Road area
  { lat: 52.4650, lng: -1.8880 },
  // Newtown
  { lat: 52.4940, lng: -1.8830 },
  // Small Heath edge
  { lat: 52.4700, lng: -1.8650 },
  // Sparkbrook
  { lat: 52.4620, lng: -1.8810 },
  // Lozells
  { lat: 52.4980, lng: -1.8950 },
  // Handsworth edge
  { lat: 52.5000, lng: -1.9080 },
];

function GuardMarker({ index }: { index: number }) {
  const pulse = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const delay = index * 300;
    const timeout = setTimeout(() => {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          RNAnimated.timing(pulse, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <RNAnimated.View style={[markerStyles.container, { transform: [{ scale }], opacity }]}>
      <View style={markerStyles.glowRing} />
      <View style={markerStyles.badge}>
        <Text style={markerStyles.emoji}>🛡️</Text>
      </View>
    </RNAnimated.View>
  );
}

const markerStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  glowRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,212,170,0.18)",
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8,10,15,0.85)",
    borderWidth: 1.5,
    borderColor: "rgba(0,212,170,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 16,
  },
});

export function VenuesMap({ center, showGuards = true }: VenuesMapProps) {
  const mapRef = React.useRef<MapView>(null);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
        mapType="standard"
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        userInterfaceStyle="dark"
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {showGuards &&
          GUARD_POSITIONS.map((g, i) => (
            <Marker
              key={`guard-${i}`}
              coordinate={{ latitude: g.lat, longitude: g.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === "ios"}
            >
              <GuardMarker index={i} />
            </Marker>
          ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
  },
  map: {
    flex: 1,
    width: "100%",
  },
});
