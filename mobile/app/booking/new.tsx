/**
 * Premium Booking Flow
 * Streamlined 4-step booking with animations and progress indicator
 */

import { useState, useRef, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../../lib/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SECURITY_TYPES = [
  { id: "door", label: "Door Security", icon: "🚪", desc: "Club, bar & venue entry" },
  { id: "event", label: "Event Security", icon: "🎪", desc: "Concerts & festivals" },
  { id: "close_protection", label: "Close Protection", icon: "🛡️", desc: "VIP & executive" },
  { id: "crowd_control", label: "Crowd Control", icon: "👥", desc: "Large gatherings" },
];

const STEPS = [
  { id: 1, title: "Date & Time" },
  { id: 2, title: "Requirements" },
  { id: 3, title: "Review" },
  { id: 4, title: "Confirm" },
];

// Progress indicator component
function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        {STEPS.map((step, index) => {
          const isActive = step.id <= currentStep;
          const isComplete = step.id < currentStep;
          
          return (
            <View key={step.id} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  isActive && styles.progressDotActive,
                  isComplete && styles.progressDotComplete,
                ]}
              >
                {isComplete ? (
                  <Text style={styles.progressCheck}>✓</Text>
                ) : (
                  <Text style={[styles.progressNumber, isActive && styles.progressNumberActive]}>
                    {step.id}
                  </Text>
                )}
              </View>
              {index < STEPS.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    isComplete && styles.progressLineComplete,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.progressLabels}>
        {STEPS.map((step) => (
          <Text
            key={step.id}
            style={[
              styles.progressLabel,
              step.id === currentStep && styles.progressLabelActive,
            ]}
          >
            {step.title}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Step 1: Date & Time
function DateTimeStep({
  eventDate,
  setEventDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}: {
  eventDate: Date;
  setEventDate: (d: Date) => void;
  startTime: Date;
  setStartTime: (d: Date) => void;
  endTime: Date;
  setEndTime: (d: Date) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>When do you need security?</Text>
      <Text style={styles.stepSubtitle}>Select the date and shift times</Text>

      {/* Date Selection */}
      <TouchableOpacity
        style={styles.dateCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowDatePicker(true);
        }}
      >
        <View style={styles.dateIcon}>
          <Text style={styles.dateIconText}>📅</Text>
        </View>
        <View style={styles.dateContent}>
          <Text style={styles.dateLabel}>Event Date</Text>
          <Text style={styles.dateValue}>{formatDate(eventDate)}</Text>
        </View>
        <Text style={styles.dateArrow}>›</Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={eventDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowDatePicker(Platform.OS === "ios");
            if (date) setEventDate(date);
          }}
          minimumDate={new Date()}
          themeVariant="dark"
        />
      )}

      {/* Time Selection */}
      <View style={styles.timeRow}>
        <TouchableOpacity
          style={[styles.timeCard, styles.timeCardHalf]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowStartPicker(true);
          }}
        >
          <Text style={styles.timeLabel}>Start Time</Text>
          <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
        </TouchableOpacity>

        <View style={styles.timeDivider}>
          <Text style={styles.timeDividerText}>→</Text>
        </View>

        <TouchableOpacity
          style={[styles.timeCard, styles.timeCardHalf]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowEndPicker(true);
          }}
        >
          <Text style={styles.timeLabel}>End Time</Text>
          <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowStartPicker(Platform.OS === "ios");
            if (date) setStartTime(date);
          }}
          themeVariant="dark"
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowEndPicker(Platform.OS === "ios");
            if (date) setEndTime(date);
          }}
          themeVariant="dark"
        />
      )}

      {/* Duration Summary */}
      <View style={styles.durationCard}>
        <Text style={styles.durationIcon}>⏱️</Text>
        <Text style={styles.durationText}>
          Shift Duration:{" "}
          <Text style={styles.durationValue}>
            {Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours
          </Text>
        </Text>
      </View>
    </View>
  );
}

// Step 2: Requirements
function RequirementsStep({
  securityType,
  setSecurityType,
  staffCount,
  setStaffCount,
  hourlyRate,
  setHourlyRate,
}: {
  securityType: string;
  setSecurityType: (s: string) => void;
  staffCount: string;
  setStaffCount: (s: string) => void;
  hourlyRate: string;
  setHourlyRate: (s: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What type of security?</Text>
      <Text style={styles.stepSubtitle}>Select the security type and staff count</Text>

      {/* Security Type Grid */}
      <View style={styles.typeGrid}>
        {SECURITY_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeCard,
              securityType === type.id && styles.typeCardSelected,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSecurityType(type.id);
            }}
          >
            <Text style={styles.typeIcon}>{type.icon}</Text>
            <Text style={styles.typeLabel}>{type.label}</Text>
            <Text style={styles.typeDesc}>{type.desc}</Text>
            {securityType === type.id && (
              <View style={styles.typeCheckmark}>
                <Text style={styles.typeCheckmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Staff Count */}
      <Text style={styles.inputLabel}>Number of Security Staff</Text>
      <View style={styles.counterRow}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const current = parseInt(staffCount) || 1;
            if (current > 1) setStaffCount(String(current - 1));
          }}
        >
          <Text style={styles.counterBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.counterValue}>
          <Text style={styles.counterValueText}>{staffCount}</Text>
        </View>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const current = parseInt(staffCount) || 1;
            if (current < 50) setStaffCount(String(current + 1));
          }}
        >
          <Text style={styles.counterBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Hourly Rate */}
      <Text style={styles.inputLabel}>Hourly Rate (per person)</Text>
      <View style={styles.rateInput}>
        <Text style={styles.rateCurrency}>£</Text>
        <TextInput
          style={styles.rateValue}
          value={hourlyRate}
          onChangeText={setHourlyRate}
          keyboardType="decimal-pad"
          placeholder="18"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.rateUnit}>/hour</Text>
      </View>
    </View>
  );
}

// Step 3: Review
function ReviewStep({
  eventDate,
  startTime,
  endTime,
  securityType,
  staffCount,
  hourlyRate,
  notes,
  setNotes,
}: {
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  securityType: string;
  staffCount: string;
  hourlyRate: string;
  notes: string;
  setNotes: (s: string) => void;
}) {
  const hours = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
  const rate = parseFloat(hourlyRate) || 0;
  const count = parseInt(staffCount) || 0;
  const total = hours * rate * count;

  const selectedType = SECURITY_TYPES.find((t) => t.id === securityType);

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review your booking</Text>
      <Text style={styles.stepSubtitle}>Check the details before confirming</Text>

      <View style={styles.reviewCard}>
        {/* Date & Time */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewIcon}>📅</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewLabel}>Date & Time</Text>
            <Text style={styles.reviewValue}>
              {eventDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </Text>
            <Text style={styles.reviewSubvalue}>
              {startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} -{" "}
              {endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ({hours.toFixed(1)} hrs)
            </Text>
          </View>
        </View>

        <View style={styles.reviewDivider} />

        {/* Security Type */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewIcon}>{selectedType?.icon || "🛡️"}</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewLabel}>Security Type</Text>
            <Text style={styles.reviewValue}>{selectedType?.label || "Security"}</Text>
          </View>
        </View>

        <View style={styles.reviewDivider} />

        {/* Staff & Rate */}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewIcon}>👥</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewLabel}>Staff & Rate</Text>
            <Text style={styles.reviewValue}>{staffCount} staff @ £{hourlyRate}/hr</Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      <Text style={styles.inputLabel}>Additional Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any special requirements or instructions..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={3}
      />

      {/* Price Breakdown */}
      <View style={styles.priceCard}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Subtotal ({count} × £{rate} × {hours.toFixed(1)} hrs)</Text>
          <Text style={styles.priceValue}>£{total.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Platform fee (5%)</Text>
          <Text style={styles.priceValue}>£{(total * 0.05).toFixed(2)}</Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceRow}>
          <Text style={styles.priceTotalLabel}>Total</Text>
          <Text style={styles.priceTotalValue}>£{(total * 1.05).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// Step 4: Confirmation Success
function ConfirmationStep() {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.confirmationContent,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={["rgba(45, 212, 191, 0.2)", "rgba(45, 212, 191, 0.05)"]}
        style={styles.confirmationIcon}
      >
        <Text style={styles.confirmationEmoji}>🎉</Text>
      </LinearGradient>
      <Text style={styles.confirmationTitle}>Booking Submitted!</Text>
      <Text style={styles.confirmationText}>
        Your booking request has been sent. Security personnel will be notified and you'll receive
        confirmations shortly.
      </Text>
      <View style={styles.confirmationInfo}>
        <Text style={styles.confirmationInfoIcon}>📧</Text>
        <Text style={styles.confirmationInfoText}>
          Check your email for confirmation details
        </Text>
      </View>
    </Animated.View>
  );
}

export default function NewBookingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [eventDate, setEventDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 6 * 60 * 60 * 1000));
  const [securityType, setSecurityType] = useState("door");
  const [staffCount, setStaffCount] = useState("2");
  const [hourlyRate, setHourlyRate] = useState("18");
  const [notes, setNotes] = useState("");

  const animateStep = (direction: "next" | "back") => {
    const toValue = direction === "next" ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const nextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateStep("next");
    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateStep("back");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!supabase) {
      Alert.alert("Error", "Not connected to server");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to create a booking");

      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile) throw new Error("Profile not found");

      const venueId = await getVenueId(supabase, profile.profileId);
      if (!venueId) throw new Error("Venue profile not found");

      const start = new Date(eventDate);
      start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      
      const end = new Date(eventDate);
      end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const rate = parseFloat(hourlyRate) * 100; // Convert to pence
      const count = parseInt(staffCount);

      const { error } = await supabase.from("bookings").insert({
        venue_id: venueId,
        event_date: eventDate.toISOString().split("T")[0],
        start_time: startTime.toTimeString().slice(0, 5),
        end_time: endTime.toTimeString().slice(0, 5),
        guards_count: count,
        rate: rate,
        currency: "GBP",
        status: "pending",
        notes: notes || null,
        security_type: securityType,
      });

      if (error) throw error;

      setStep(4);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (step === 1 || step === 4) {
              router.back();
            } else {
              prevStep();
            }
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>{step === 1 || step === 4 ? "✕" : "←"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Progress Indicator */}
      {step < 4 && <ProgressIndicator currentStep={step} />}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {step === 1 && (
            <DateTimeStep
              eventDate={eventDate}
              setEventDate={setEventDate}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
            />
          )}
          {step === 2 && (
            <RequirementsStep
              securityType={securityType}
              setSecurityType={setSecurityType}
              staffCount={staffCount}
              setStaffCount={setStaffCount}
              hourlyRate={hourlyRate}
              setHourlyRate={setHourlyRate}
            />
          )}
          {step === 3 && (
            <ReviewStep
              eventDate={eventDate}
              startTime={startTime}
              endTime={endTime}
              securityType={securityType}
              staffCount={staffCount}
              hourlyRate={hourlyRate}
              notes={notes}
              setNotes={setNotes}
            />
          )}
          {step === 4 && <ConfirmationStep />}
        </Animated.View>
      </ScrollView>

      {/* Footer Button */}
      {step < 4 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={step === 3 ? handleSubmit : nextStep}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={loading ? ["#555", "#444"] : [colors.accent, "#1fa89e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGradient}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Creating..." : step === 3 ? "Confirm Booking" : "Continue"}
              </Text>
              {!loading && <Text style={styles.primaryBtnIcon}>→</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {step === 4 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tabs)/account")}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.accent, "#1fa89e"]}
              style={styles.primaryBtnGradient}
            >
              <Text style={styles.primaryBtnText}>View My Bookings</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 20,
    color: colors.text,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStep: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    borderColor: colors.accent,
  },
  progressDotComplete: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  progressNumber: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  progressNumberActive: {
    color: colors.accent,
  },
  progressCheck: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  progressLineComplete: {
    backgroundColor: colors.accent,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    flex: 1,
    textAlign: "center",
  },
  progressLabelActive: {
    color: colors.accent,
    fontWeight: "600",
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  stepContent: {
    paddingHorizontal: spacing.lg,
  },
  stepTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 22,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },

  // Date & Time
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  dateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  dateIconText: {
    fontSize: 20,
  },
  dateContent: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dateValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  dateArrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  timeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  timeCardHalf: {
    flex: 1,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  timeValue: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
  },
  timeDivider: {
    paddingHorizontal: spacing.sm,
  },
  timeDividerText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  durationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  durationIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  durationText: {
    ...typography.body,
    color: colors.textMuted,
  },
  durationValue: {
    color: colors.accent,
    fontWeight: "600",
  },

  // Requirements
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  typeCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    position: "relative",
  },
  typeCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(45, 212, 191, 0.05)",
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginBottom: 2,
  },
  typeDesc: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  typeCheckmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCheckmarkText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
  },
  inputLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnText: {
    fontSize: 24,
    color: colors.accent,
  },
  counterValue: {
    flex: 1,
    alignItems: "center",
  },
  counterValueText: {
    ...typography.display,
    color: colors.text,
    fontSize: 32,
  },
  rateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  rateCurrency: {
    ...typography.title,
    color: colors.accent,
    fontSize: 24,
    marginRight: spacing.xs,
  },
  rateValue: {
    flex: 1,
    ...typography.title,
    color: colors.text,
    fontSize: 24,
  },
  rateUnit: {
    ...typography.body,
    color: colors.textMuted,
  },

  // Review
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  reviewIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  reviewContent: {
    flex: 1,
  },
  reviewLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reviewValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  reviewSubvalue: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  priceCard: {
    backgroundColor: "rgba(45, 212, 191, 0.05)",
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.2)",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  priceLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  priceValue: {
    ...typography.body,
    color: colors.text,
  },
  priceDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: spacing.sm,
  },
  priceTotalLabel: {
    ...typography.title,
    color: colors.text,
  },
  priceTotalValue: {
    ...typography.title,
    color: colors.accent,
    fontSize: 20,
  },

  // Confirmation
  confirmationContent: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
  },
  confirmationIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  confirmationEmoji: {
    fontSize: 48,
  },
  confirmationTitle: {
    ...typography.display,
    color: colors.text,
    fontSize: 28,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  confirmationText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  confirmationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  confirmationInfoIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  confirmationInfoText: {
    ...typography.caption,
    color: colors.accent,
  },

  // Footer
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  primaryBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  primaryBtnIcon: {
    fontSize: 18,
    color: colors.text,
  },
});
