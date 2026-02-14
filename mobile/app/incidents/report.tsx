import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoiceRecorder } from '../../components/incidents/VoiceRecorder';
import { colors, typography, spacing, radius } from '../../theme';
import * as Haptics from 'expo-haptics';

export default function ReportIncidentScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'record' | 'processing' | 'review'>('record');
  const [transcription, setTranscription] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTranscriptionStart = () => {
    setStep('processing');
  };

  const handleTranscriptionComplete = (text: string, aiAnalysis: any) => {
    setTranscription(text);
    setAnalysis(aiAnalysis);
    setStep('review');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }, 1500);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Incident</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'record' && (
          <View style={styles.recordStep}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✨ Powered by Shield AI</Text>
            </View>
            <Text style={styles.mainTitle}>Voice Report</Text>
            <Text style={styles.subtitle}>
              Hold the button to record your incident report. Shield AI will transcribe and format it automatically.
            </Text>
            
            <VoiceRecorder 
              onRecordingComplete={(uri) => console.log('Recorded to:', uri)}
              onTranscriptionStart={handleTranscriptionStart}
              onTranscriptionComplete={handleTranscriptionComplete}
            />
          </View>
        )}

        {step === 'processing' && (
          <View style={styles.processingStep}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.processingTitle}>Processing Audio...</Text>
            <Text style={styles.processingSubtitle}>Shield AI is analyzing the incident details</Text>
            
            <View style={styles.transcribingPreview}>
              <View style={[styles.skeletonLine, { width: '90%' }]} />
              <View style={[styles.skeletonLine, { width: '80%' }]} />
              <View style={[styles.skeletonLine, { width: '60%' }]} />
            </View>
          </View>
        )}

        {step === 'review' && (
          <View style={styles.reviewStep}>
            <Text style={styles.reviewTitle}>Review Report</Text>
            
            {/* AI Analysis Cards */}
            <View style={styles.analysisGrid}>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisLabel}>Type</Text>
                <Text style={styles.analysisValue}>{analysis?.type}</Text>
              </View>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisLabel}>Severity</Text>
                <View style={[styles.severityBadge, { 
                  backgroundColor: analysis?.severity === 'high' ? colors.error : colors.warning 
                }]}>
                  <Text style={styles.severityText}>{analysis?.severity}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Transcription</Text>
              <TextInput
                style={styles.textArea}
                multiline
                value={transcription}
                onChangeText={setTranscription}
                placeholder="Incident details..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key Details Extracted</Text>
              <View style={styles.detailsList}>
                <Text style={styles.detailItem}>🕒 Time: {analysis?.time}</Text>
                <Text style={styles.detailItem}>📍 Location: {analysis?.location}</Text>
                <Text style={styles.detailItem}>👥 Involved: {analysis?.involved.join(', ')}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Official Report</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 16,
  },
  headerTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  content: {
    flexGrow: 1,
  },
  recordStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    paddingTop: 60,
  },
  aiBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  aiBadgeText: {
    color: '#a78bfa',
    fontWeight: '600',
    fontSize: 12,
  },
  mainTitle: {
    ...typography.display,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    maxWidth: 300,
  },
  processingStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  processingTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  processingSubtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  transcribingPreview: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.sm,
    opacity: 0.5,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
  },
  reviewStep: {
    padding: spacing.lg,
  },
  reviewTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  analysisGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  analysisCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  analysisLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  analysisValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    ...typography.captionMuted,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailItem: {
    ...typography.body,
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  submitButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
});
