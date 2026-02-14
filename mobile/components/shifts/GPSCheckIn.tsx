import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

type Shift = {
  id: string;
  venue: string;
  venueAddress: string;
  venueLat: number;
  venueLng: number;
  date: string;
  startTime: string;
  endTime: string;
  rate: number;
  status: "upcoming" | "checked_in" | "checked_out";
  checkInTime?: string;
  checkOutTime?: string;
};

type Props = {
  shift: Shift;
  onCheckIn: (shiftId: string, location: { lat: number; lng: number }, time: string) => void;
  onCheckOut: (shiftId: string, location: { lat: number; lng: number }, time: string) => void;
};

const GEOFENCE_RADIUS_METERS = 100; // Must be within 100m of venue

export function GPSCheckIn({ shift, onCheckIn, onCheckOut }: Props) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setErrorMsg("Location permission is required for check-in");
      return;
    }
    getCurrentLocation();
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const currentLoc = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      setLocation(currentLoc);
      
      // Calculate distance to venue
      const dist = calculateDistance(
        currentLoc.lat,
        currentLoc.lng,
        shift.venueLat,
        shift.venueLng
      );
      setDistance(dist);
      setErrorMsg(null);
    } catch (error) {
      setErrorMsg("Failed to get location");
    } finally {
      setLoading(false);
    }
  };

  // Haversine formula for distance calculation
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const isWithinGeofence = distance !== null && distance <= GEOFENCE_RADIUS_METERS;

  const handleCheckIn = () => {
    if (!location) {
      Alert.alert("Error", "Unable to get your location");
      return;
    }

    if (!isWithinGeofence) {
      Alert.alert(
        "Too Far From Venue",
        `You must be within ${GEOFENCE_RADIUS_METERS}m of the venue to check in. You are currently ${Math.round(distance || 0)}m away.`,
        [{ text: "OK" }]
      );
      return;
    }

    const now = new Date().toISOString();
    onCheckIn(shift.id, location, now);
    Alert.alert("Checked In!", `You've checked in at ${new Date().toLocaleTimeString()}`);
  };

  const handleCheckOut = () => {
    if (!location) {
      Alert.alert("Error", "Unable to get your location");
      return;
    }

    // For check-out, we're more lenient with location
    const now = new Date().toISOString();
    onCheckOut(shift.id, location, now);
    
    // Calculate hours worked
    if (shift.checkInTime) {
      const checkIn = new Date(shift.checkInTime);
      const checkOut = new Date(now);
      const hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      const earnings = hoursWorked * shift.rate;
      
      Alert.alert(
        "Shift Complete!",
        `Hours worked: ${hoursWorked.toFixed(1)}hrs\nEarnings: £${earnings.toFixed(2)}`,
        [{ text: "Great!" }]
      );
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      {/* Shift Info */}
      <View style={styles.shiftInfo}>
        <Text style={styles.venue}>{shift.venue}</Text>
        <Text style={styles.address}>{shift.venueAddress}</Text>
        <Text style={styles.time}>
          {shift.startTime} - {shift.endTime}
        </Text>
      </View>

      {/* Location Status */}
      <View style={styles.locationStatus}>
        {loading ? (
          <ActivityIndicator color="#14b8a6" />
        ) : errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : distance !== null ? (
          <View style={styles.distanceContainer}>
            <View
              style={[
                styles.distanceIndicator,
                isWithinGeofence ? styles.withinRange : styles.outOfRange,
              ]}
            />
            <Text
              style={[
                styles.distanceText,
                isWithinGeofence ? styles.withinRangeText : styles.outOfRangeText,
              ]}
            >
              {distance < 1000
                ? `${Math.round(distance)}m from venue`
                : `${(distance / 1000).toFixed(1)}km from venue`}
            </Text>
          </View>
        ) : null}
        
        <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄 Refresh Location</Text>
        </TouchableOpacity>
      </View>

      {/* Check-in Times */}
      {shift.checkInTime && (
        <View style={styles.timestamps}>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Checked In:</Text>
            <Text style={styles.timestampValue}>{formatTime(shift.checkInTime)}</Text>
          </View>
          {shift.checkOutTime && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Checked Out:</Text>
              <Text style={styles.timestampValue}>{formatTime(shift.checkOutTime)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {shift.status === "upcoming" && (
          <TouchableOpacity
            style={[
              styles.checkInButton,
              !isWithinGeofence && styles.disabledButton,
            ]}
            onPress={handleCheckIn}
            disabled={!isWithinGeofence || loading}
          >
            <Text style={styles.buttonIcon}>📍</Text>
            <Text style={styles.buttonText}>Check In</Text>
            {!isWithinGeofence && (
              <Text style={styles.buttonSubtext}>
                Get closer to venue
              </Text>
            )}
          </TouchableOpacity>
        )}

        {shift.status === "checked_in" && (
          <TouchableOpacity
            style={styles.checkOutButton}
            onPress={handleCheckOut}
            disabled={loading}
          >
            <Text style={styles.buttonIcon}>✅</Text>
            <Text style={styles.buttonText}>Check Out</Text>
            <Text style={styles.buttonSubtext}>End your shift</Text>
          </TouchableOpacity>
        )}

        {shift.status === "checked_out" && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓ Shift Completed</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📋 Check-in Instructions</Text>
        <Text style={styles.instructionsText}>
          1. Arrive at the venue location{"\n"}
          2. Ensure GPS is enabled{"\n"}
          3. Press "Check In" when within {GEOFENCE_RADIUS_METERS}m{"\n"}
          4. Press "Check Out" when your shift ends
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#0a0a0f",
  },
  shiftInfo: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  venue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: "#71717a",
    marginBottom: 8,
  },
  time: {
    fontSize: 16,
    color: "#14b8a6",
    fontWeight: "600",
  },
  locationStatus: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  distanceIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  withinRange: {
    backgroundColor: "#10b981",
  },
  outOfRange: {
    backgroundColor: "#f59e0b",
  },
  distanceText: {
    fontSize: 16,
    fontWeight: "600",
  },
  withinRangeText: {
    color: "#10b981",
  },
  outOfRangeText: {
    color: "#f59e0b",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 8,
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  refreshText: {
    color: "#71717a",
    fontSize: 14,
  },
  timestamps: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  timestampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timestampLabel: {
    color: "#71717a",
    fontSize: 14,
  },
  timestampValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    marginBottom: 16,
  },
  checkInButton: {
    backgroundColor: "#14b8a6",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  checkOutButton: {
    backgroundColor: "#8b5cf6",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#3f3f46",
    opacity: 0.7,
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  buttonSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 4,
  },
  completedBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  completedText: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "700",
  },
  instructions: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  instructionsTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  instructionsText: {
    color: "#71717a",
    fontSize: 13,
    lineHeight: 22,
  },
});

export default GPSCheckIn;
