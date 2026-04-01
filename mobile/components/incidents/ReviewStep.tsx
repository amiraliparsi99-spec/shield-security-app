/**
 * Post-shift summary — step 3: review and submit.
 */

import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { INCIDENT_TEMPLATES } from "../../constants/incidents";
import type { IncidentEntry } from "../../constants/incidents";

const colors = {
  text: "#ffffff",
  textMuted: "#9ca3af",
  surface: "#13131a",
  surfaceLight: "#1a1a24",
  success: "#22c55e",
};

export interface ReviewStepProps {
  selectedIncidents: string[];
  incidents: IncidentEntry[];
  voiceTranscript: string;
  additionalNotes: string;
  isSubmitting: boolean;
  onUpdateDescription: (incidentId: string, description: string) => void;
  onAdditionalNotesChange: (text: string) => void;
  onSubmit: () => void;
}

export function ReviewStep({
  selectedIncidents,
  incidents,
  voiceTranscript,
  additionalNotes,
  isSubmitting,
  onUpdateDescription,
  onAdditionalNotesChange,
  onSubmit,
}: ReviewStepProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Review & Submit</Text>
          <Text style={styles.subtitle}>
            {selectedIncidents.includes("none")
              ? "Confirm no incidents occurred"
              : "Add details for each incident"}
          </Text>
        </View>

        {selectedIncidents.includes("none") ? (
          <View style={styles.noIncidentsCard}>
            <Text style={styles.noIncidentsIcon}>✅</Text>
            <Text style={styles.noIncidentsTitle}>No Incidents</Text>
            <Text style={styles.noIncidentsSubtitle}>Great shift! No incidents to report.</Text>
          </View>
        ) : (
          <>
            {voiceTranscript && (
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptLabel}>Voice Transcript</Text>
                <Text style={styles.transcriptText}>{voiceTranscript}</Text>
              </View>
            )}
            {incidents.map((incident, index) => {
              const template = INCIDENT_TEMPLATES.find((t) => t.id === incident.type);
              return (
                <View key={incident.id} style={styles.incidentCard}>
                  <View style={styles.incidentHeader}>
                    <View
                      style={[styles.incidentBadge, { backgroundColor: `${template?.color}20` }]}
                    >
                      <Text style={styles.incidentBadgeIcon}>{template?.icon}</Text>
                      <Text style={[styles.incidentBadgeText, { color: template?.color }]}>
                        {template?.label}
                      </Text>
                    </View>
                    <Text style={styles.incidentNumber}>#{index + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.incidentInput}
                    placeholder="Describe what happened..."
                    placeholderTextColor={colors.textMuted}
                    value={incident.description}
                    onChangeText={(text) => onUpdateDescription(incident.id, text)}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              );
            })}
          </>
        )}

        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any other observations or comments..."
            placeholderTextColor={colors.textMuted}
            value={additionalNotes}
            onChangeText={onAdditionalNotesChange}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.submitGradient}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit Report</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textMuted },
  noIncidentsCard: {
    backgroundColor: `${colors.success}15`,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
  },
  noIncidentsIcon: { fontSize: 48, marginBottom: 12 },
  noIncidentsTitle: { fontSize: 20, fontWeight: "700", color: colors.success, marginBottom: 4 },
  noIncidentsSubtitle: { fontSize: 14, color: colors.textMuted },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  transcriptText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  incidentCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  incidentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  incidentBadgeIcon: { fontSize: 16 },
  incidentBadgeText: { fontSize: 13, fontWeight: "600" },
  incidentNumber: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  incidentInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
  },
  notesSection: { marginTop: 8, marginBottom: 24 },
  notesLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
  },
  submitButton: { marginBottom: 20 },
  submitButtonDisabled: { opacity: 0.6 },
  submitGradient: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
