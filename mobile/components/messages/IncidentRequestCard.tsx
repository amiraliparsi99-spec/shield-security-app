/**
 * Renders a Mission Control message as either a tappable "Incident Report Requested" card
 * or a read-only "Incident Report Submitted" card when completed.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "../../theme";
import { safeHaptic } from "../../lib/haptics";

export interface IncidentRequestCardProps {
  shiftId: string | undefined;
  venueId: string | undefined;
  venueName: string;
  isCompleted: boolean;
  completedIncidents: number;
  onPress?: () => void;
}

export function IncidentRequestCard({
  shiftId,
  venueId,
  venueName,
  isCompleted,
  completedIncidents,
  onPress,
}: IncidentRequestCardProps) {
  if (isCompleted) {
    return (
      <View style={styles.completedCard}>
        <View style={styles.completedIcon}>
          <Text style={{ fontSize: 24 }}>✅</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.completedTitle}>Incident Report Submitted</Text>
          <Text style={styles.completedSubtitle}>
            {completedIncidents === 0
              ? "No incidents reported - clean shift"
              : `${completedIncidents} incident${completedIncidents !== 1 ? "s" : ""} reported`}
          </Text>
        </View>
      </View>
    );
  }

  const handlePress = () => {
    safeHaptic("medium");
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: "/post-shift-summary",
        params: {
          shiftId: shiftId || "from-mission-control",
          venueId: venueId || "",
          venueName,
          requested: "true",
        },
      });
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.icon}>
        <Text style={{ fontSize: 24 }}>📋</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Incident Report Requested</Text>
        <Text style={styles.subtitle}>Tap to submit your post-shift report</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b5cf620",
    borderWidth: 1,
    borderColor: "#8b5cf640",
    borderRadius: 16,
    padding: 16,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#8b5cf630",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#a78bfa",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  arrow: {
    fontSize: 20,
    color: "#8b5cf6",
    fontWeight: "600",
  },
  completedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22c55e15",
    borderWidth: 1,
    borderColor: "#22c55e40",
    borderRadius: 16,
    padding: 16,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  completedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#22c55e25",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  completedTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4ade80",
    marginBottom: 2,
  },
  completedSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
