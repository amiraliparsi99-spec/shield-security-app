/**
 * Post-shift summary — step 2: voice record or skip.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { INCIDENT_TEMPLATES } from "../../constants/incidents";

const colors = {
  primary: "#8b5cf6",
  error: "#ef4444",
  text: "#ffffff",
  textMuted: "#9ca3af",
};

export interface VoiceStepProps {
  selectedIncidents: string[];
  isTranscribing: boolean;
  pulseAnim: Animated.Value;
  scaleAnim: Animated.Value;
  isRecording: boolean;
  recordingDuration: number;
  onPressIn: () => void;
  onPressOut: () => void;
  onSkip: () => void;
  formatDuration: (seconds: number) => string;
}

export function VoiceStep({
  selectedIncidents,
  isTranscribing,
  pulseAnim,
  scaleAnim,
  isRecording,
  recordingDuration,
  onPressIn,
  onPressOut,
  onSkip,
  formatDuration,
}: VoiceStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Describe Incidents</Text>
        <Text style={styles.subtitle}>Hold to record a voice summary of what happened</Text>
      </View>

      <View style={styles.selectedBadges}>
        {selectedIncidents.map((id) => {
          const template = INCIDENT_TEMPLATES.find((t) => t.id === id);
          return (
            <View
              key={id}
              style={[styles.selectedBadge, { backgroundColor: `${template?.color}20` }]}
            >
              <Text style={styles.selectedBadgeText}>
                {template?.icon} {template?.label}
              </Text>
            </View>
          );
        })}
      </View>

      {isTranscribing ? (
        <View style={styles.transcribingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.transcribingText}>Transcribing audio...</Text>
        </View>
      ) : (
        <>
          <View style={styles.micContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }], opacity: isRecording ? 0.3 : 0 },
              ]}
            />
            <TouchableOpacity
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={1}
              style={styles.micButtonWrapper}
            >
              <Animated.View style={[styles.micButton, { transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient
                  colors={isRecording ? ["#ef4444", "#b91c1c"] : ["#8b5cf6", "#7c3aed"]}
                  style={styles.micGradient}
                >
                  <Text style={styles.micIcon}>{isRecording ? "⬛" : "🎙️"}</Text>
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.recordingStatus}>
              {isRecording ? "Recording..." : "Hold to Record"}
            </Text>
            {isRecording && (
              <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
            )}
          </View>
          <Text style={styles.voiceHint}>
            Describe each incident: what happened, when, where, and who was involved
          </Text>
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipText}>Skip voice, type instead →</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textMuted },
  selectedBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  selectedBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  selectedBadgeText: { fontSize: 13, color: colors.text, fontWeight: "500" },
  micContainer: { alignItems: "center", justifyContent: "center", marginVertical: 40 },
  pulseRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.error,
  },
  micButtonWrapper: { zIndex: 10 },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  micGradient: {
    flex: 1,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.2)",
  },
  micIcon: { fontSize: 48 },
  recordingStatus: { marginTop: 20, fontSize: 18, fontWeight: "600", color: colors.text },
  recordingTimer: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "700",
    color: colors.error,
    fontVariant: ["tabular-nums"],
  },
  voiceHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  skipButton: { marginTop: 32, alignItems: "center" },
  skipText: { fontSize: 14, color: colors.primary, fontWeight: "500" },
  transcribingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  transcribingText: { marginTop: 16, fontSize: 16, color: colors.textMuted },
});
