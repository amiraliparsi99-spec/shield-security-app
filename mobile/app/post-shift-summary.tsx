import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { getUserMessage } from "../lib/errorHandler";
import { INCIDENT_TEMPLATES } from "../constants/incidents";
import type { IncidentEntry } from "../constants/incidents";
import { TemplateStep } from "../components/incidents/TemplateStep";
import { VoiceStep } from "../components/incidents/VoiceStep";
import { ReviewStep } from "../components/incidents/ReviewStep";
import { useAuthStore, useShiftStore } from "../stores";

const colors = {
  background: "#0a0a0f",
  surface: "#13131a",
  primary: "#8b5cf6",
  text: "#ffffff",
  textMuted: "#9ca3af",
  border: "rgba(255,255,255,0.1)",
};

export default function PostShiftSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    shiftId?: string; 
    venueId?: string;
    venueName?: string;
    requested?: string;
  }>();
  const { user } = useAuthStore();
  const { activeShift } = useShiftStore();
  const userId = user?.id ?? null;
  const shiftIdFromStore = activeShift?.shiftId ?? activeShift?.id;
  const venueIdFromStore = activeShift?.booking?.venue_id ?? null;
  const venueNameFromStore = activeShift?.booking?.venue?.name ?? null;

  const [step, setStep] = useState<"templates" | "voice" | "review">("templates");
  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([]);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isRequested = params.requested === "true";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  const safeHaptic = (type: "light" | "medium" | "heavy" | "selection" | "success" | "error") => {
    try {
      if (type === "selection") {
        Haptics.selectionAsync();
      } else if (type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(
          type === "light" ? Haptics.ImpactFeedbackStyle.Light :
          type === "heavy" ? Haptics.ImpactFeedbackStyle.Heavy :
          Haptics.ImpactFeedbackStyle.Medium
        );
      }
    } catch {}
  };

  const toggleIncident = (id: string) => {
    safeHaptic("selection");
    
    if (id === "none") {
      // If "No Incidents" is selected, clear all others
      setSelectedIncidents(["none"]);
      return;
    }
    
    // Remove "none" if selecting an incident
    setSelectedIncidents((prev) => {
      const withoutNone = prev.filter((i) => i !== "none");
      if (withoutNone.includes(id)) {
        return withoutNone.filter((i) => i !== id);
      }
      return [...withoutNone, id];
    });
  };

  const handleContinue = () => {
    safeHaptic("medium");
    
    if (selectedIncidents.includes("none")) {
      // No incidents - go straight to review with empty list
      setStep("review");
    } else if (selectedIncidents.length === 0) {
      Alert.alert("Select Incidents", "Please select at least one incident type or 'No Incidents'");
    } else {
      // Has incidents - go to voice recording
      setStep("voice");
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      if (permissionResponse?.status !== "granted") {
        const { status } = await requestPermission();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Microphone access is needed for voice recording");
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      safeHaptic("medium");

      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    if (timerRef.current) clearInterval(timerRef.current);

    if (!recording) return;

    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      safeHaptic("success");
      await transcribeAudio(uri);
    }
  };

  const transcribeAudio = async (uri: string) => {
    setIsTranscribing(true);

    try {
      // TODO: Integrate with actual transcription API (Whisper, etc.)
      // For now, simulate transcription
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock transcription result
      const mockTranscript = `During my shift tonight, I observed the following incidents:\n\n${selectedIncidents
        .map((id) => {
          const template = INCIDENT_TEMPLATES.find((t) => t.id === id);
          return `- ${template?.label}: [Details to be filled in]`;
        })
        .join("\n")}`;

      setVoiceTranscript(mockTranscript);
      
      // Create incident entries from selected types
      const newIncidents: IncidentEntry[] = selectedIncidents.map((type) => ({
        id: `${type}-${Date.now()}`,
        type,
        description: "",
        severity: "medium",
      }));
      setIncidents(newIncidents);

      setStep("review");
    } catch (error) {
      console.error("Transcription error:", error);
      Alert.alert("Error", "Failed to transcribe audio. Please try again or type manually.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const skipVoice = () => {
    safeHaptic("selection");
    
    // Create incident entries from selected types
    const newIncidents: IncidentEntry[] = selectedIncidents.map((type) => ({
      id: `${type}-${Date.now()}`,
      type,
      description: "",
      severity: "medium",
    }));
    setIncidents(newIncidents);
    
    setStep("review");
  };

  const updateIncidentDescription = (id: string, description: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, description } : inc))
    );
  };

  const handleSubmit = async () => {
    if (!supabase || !userId) {
      Alert.alert("Error", "Please sign in to submit");
      return;
    }

    // Validate that incidents have descriptions (unless no incidents)
    if (!selectedIncidents.includes("none")) {
      const emptyIncidents = incidents.filter((i) => !i.description.trim());
      if (emptyIncidents.length > 0) {
        Alert.alert(
          "Missing Details",
          "Please provide a description for each incident"
        );
        return;
      }
    }

    setIsSubmitting(true);
    safeHaptic("medium");

    try {
      
      // Get personnel ID
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", userId)
        .single();


      if (!personnel) {
        throw new Error("Personnel record not found");
      }

      let shiftId = params.shiftId || shiftIdFromStore || undefined;
      if (shiftId === "from-mission-control") shiftId = shiftIdFromStore || undefined;

      if (!shiftId) {
        throw new Error("No shift ID provided. Please try again from Mission Control or the shift tracker.");
      }

      // For test mode
      if (shiftId.startsWith("test-")) {
        safeHaptic("success");
        Alert.alert(
          "Test Mode",
          "This is a test submission. In production, this would save to the database.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      let venueId: string | null = params.venueId || venueIdFromStore || null;
      if (!venueId) {
        const { data: row } = await supabase.from("bookings").select("venue_id").eq("id", activeShift?.booking_id).maybeSingle();
        venueId = row?.venue_id ?? null;
      }
      if (!venueId) {
        throw new Error("Could not determine venue for this shift. Please try again from Mission Control or the shift tracker.");
      }
      

      // Create post-shift summary
      const summaryData = {
        shift_id: shiftId,
        personnel_id: personnel.id,
        venue_id: venueId,
        voice_transcript: voiceTranscript || null,
        summary_text: additionalNotes || null,
        total_incidents: selectedIncidents.includes("none") ? 0 : incidents.length,
        ejections_count: incidents.filter((i) => i.type === "ejection").length,
        medical_count: incidents.filter((i) => i.type === "medical").length,
        disturbances_count: incidents.filter((i) => i.type === "disturbance").length,
        notable_events: incidents.map((i) => `${i.type}: ${i.description}`),
        shift_notes: additionalNotes,
        status: "submitted",
      };
      
      const { error: summaryError } = await supabase
        .from("post_shift_summaries")
        .upsert(summaryData, { onConflict: "shift_id" });

      if (summaryError) throw summaryError;

      // Create individual incident records
      if (!selectedIncidents.includes("none") && incidents.length > 0) {
        for (const incident of incidents) {
          const incidentData = {
            shift_id: shiftId,
            personnel_id: personnel.id,
            venue_id: venueId,
            type: incident.type === "refused_entry" || incident.type === "property_damage" || 
                  incident.type === "police_called" || incident.type === "suspicious" 
                  ? "other" : incident.type,
            severity: incident.severity || "medium",
            description: incident.description,
            actions_taken: "Documented in post-shift summary",
            occurred_at: new Date().toISOString(),
          };
          
          const { error: incidentError } = await supabase
            .from("incidents")
            .insert(incidentData);

          if (incidentError) {
            console.error("Error creating incident:", incidentError);
          }
        }
      }

      // Update shift to mark report as submitted
      await supabase
        .from("shifts")
        .update({
          incident_report_submitted: true,
          incident_report_submitted_at: new Date().toISOString(),
        })
        .eq("id", shiftId);

      // Update the Mission Control message to show completed status
      // Try multiple approaches to find the message
      const { data: requestMessages, error: msgFindError } = await supabase
        .from("group_chat_messages")
        .select("id, metadata")
        .eq("message_type", "system")
        .filter("metadata->>type", "eq", "incident_report_request")
        .filter("metadata->>shift_id", "eq", shiftId);
      
      
      // Fallback: search by content if metadata filter didn't work
      let messagesToUpdate = requestMessages || [];
      if (messagesToUpdate.length === 0) {
        const { data: contentMessages } = await supabase
          .from("group_chat_messages")
          .select("id, metadata")
          .ilike("content", "%Incident Report Requested%");
        
        messagesToUpdate = contentMessages || [];
      }
      
      for (const msg of messagesToUpdate) {
        const { error: updateError } = await supabase
          .from("group_chat_messages")
          .update({
            metadata: {
              ...(msg.metadata || {}),
              completed: true,
              completed_at: new Date().toISOString(),
              total_incidents: selectedIncidents.includes("none") ? 0 : incidents.length,
            },
          })
          .eq("id", msg.id);
        
      }

      safeHaptic("success");
      Alert.alert(
        "Report Submitted",
        "Your post-shift summary has been submitted successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: unknown) {
      safeHaptic("error");
      Alert.alert("Error", getUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (step === "voice") setStep("templates");
          else if (step === "review" && !selectedIncidents.includes("none")) setStep("voice");
          else router.back();
        }}
      >
        <Text style={styles.backIcon}>←</Text>
        <Text style={styles.backText}>
          {step === "templates" ? "Cancel" : "Back"}
        </Text>
      </TouchableOpacity>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressDot, step === "templates" && styles.progressDotActive]} />
        {!selectedIncidents.includes("none") && (
          <View style={[styles.progressDot, step === "voice" && styles.progressDotActive]} />
        )}
        <View style={[styles.progressDot, step === "review" && styles.progressDotActive]} />
      </View>

      {step === "templates" && (
        <TemplateStep
          venueName={params.venueName || venueNameFromStore || "Shift"}
          isRequested={isRequested}
          selectedIncidents={selectedIncidents}
          onToggle={toggleIncident}
          onContinue={handleContinue}
        />
      )}
      {step === "voice" && (
        <VoiceStep
          selectedIncidents={selectedIncidents}
          isTranscribing={isTranscribing}
          pulseAnim={pulseAnim}
          scaleAnim={scaleAnim}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          onSkip={skipVoice}
          formatDuration={formatDuration}
        />
      )}
      {step === "review" && (
        <ReviewStep
          selectedIncidents={selectedIncidents}
          incidents={incidents}
          voiceTranscript={voiceTranscript}
          additionalNotes={additionalNotes}
          isSubmitting={isSubmitting}
          onUpdateDescription={updateIncidentDescription}
          onAdditionalNotesChange={setAdditionalNotes}
          onSubmit={handleSubmit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backIcon: {
    fontSize: 24,
    color: colors.text,
    marginRight: 8,
  },
  backText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
});
