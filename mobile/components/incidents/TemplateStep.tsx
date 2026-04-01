/**
 * Post-shift summary — step 1: select incident types or "No Incidents".
 */

import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { INCIDENT_TEMPLATES } from "../../constants/incidents";

const colors = {
  primary: "#8b5cf6",
  text: "#ffffff",
  textMuted: "#9ca3af",
  surface: "#13131a",
  border: "rgba(255,255,255,0.1)",
};

export interface TemplateStepProps {
  venueName: string;
  isRequested: boolean;
  selectedIncidents: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
}

export function TemplateStep({
  venueName,
  isRequested,
  selectedIncidents,
  onToggle,
  onContinue,
}: TemplateStepProps) {
  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Post-Shift Summary</Text>
        <Text style={styles.subtitle}>
          {venueName || "Shift"} • {new Date().toLocaleDateString()}
        </Text>
        {isRequested && (
          <View style={styles.requestedBadge}>
            <Text style={styles.requestedText}>📋 Requested by Venue</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>What happened during your shift?</Text>
      <Text style={styles.sectionSubtitle}>
        Select all that apply, or tap "No Incidents" if everything was quiet
      </Text>

      <View style={styles.templatesGrid}>
        {INCIDENT_TEMPLATES.map((template) => {
          const isSelected = selectedIncidents.includes(template.id);
          return (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateCard,
                isSelected && { borderColor: template.color, backgroundColor: `${template.color}15` },
              ]}
              onPress={() => onToggle(template.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.templateIcon}>{template.icon}</Text>
              <Text style={[styles.templateLabel, isSelected && { color: template.color }]}>
                {template.label}
              </Text>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: template.color }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.continueButton, selectedIncidents.length === 0 && styles.continueButtonDisabled]}
        onPress={onContinue}
        disabled={selectedIncidents.length === 0}
      >
        <LinearGradient
          colors={selectedIncidents.length > 0 ? ["#8b5cf6", "#7c3aed"] : ["#374151", "#1f2937"]}
          style={styles.continueGradient}
        >
          <Text style={styles.continueText}>
            {selectedIncidents.includes("none") ? "Submit Report" : "Continue"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textMuted },
  requestedBadge: {
    marginTop: 12,
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  requestedText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
  templatesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  templateCard: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  templateIcon: { fontSize: 28, marginBottom: 6 },
  templateLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  continueButton: { marginBottom: 40 },
  continueButtonDisabled: { opacity: 0.5 },
  continueGradient: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  continueText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
