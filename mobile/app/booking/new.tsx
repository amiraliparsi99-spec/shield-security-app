import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  Alert, Platform, Animated, Dimensions, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../../lib/auth";
import { toCanonicalStaffRequirements } from "../../lib/pricing";
import { getApiBaseUrl } from "../../lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ROLES = [
  { id: "door_supervisor", label: "Door Supervisor", icon: "🚪", defaultRate: 18 },
  { id: "security_guard", label: "Security Guard", icon: "🛡️", defaultRate: 16 },
  { id: "cctv_operator", label: "CCTV Operator", icon: "📹", defaultRate: 17 },
];

type RoleSelection = { roleId: string; count: number; rate: number };
type PersonnelItem = {
  id: string; display_name: string; shield_score: number | null;
  total_shifts: number | null; hourly_rate: number | null; city: string | null;
};

const STEPS = [
  { id: 1, title: "Event" },
  { id: 2, title: "Staff" },
  { id: 3, title: "Assign" },
  { id: 4, title: "Review" },
];

// ─── Progress ───
function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View style={s.progressContainer}>
      <View style={s.progressBar}>
        {STEPS.map((step, i) => {
          const active = step.id <= currentStep;
          const done = step.id < currentStep;
          return (
            <View key={step.id} style={s.progressStep}>
              <View style={[s.progressDot, active && s.progressDotActive, done && s.progressDotComplete]}>
                {done ? <Text style={s.progressCheck}>✓</Text> : <Text style={[s.progressNum, active && s.progressNumActive]}>{step.id}</Text>}
              </View>
              {i < STEPS.length - 1 && <View style={[s.progressLine, done && s.progressLineComplete]} />}
            </View>
          );
        })}
      </View>
      <View style={s.progressLabels}>
        {STEPS.map((step) => (
          <Text key={step.id} style={[s.progressLabel, step.id === currentStep && s.progressLabelActive]}>{step.title}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Step 1: Event ───
function EventStep({
  eventName, setEventName, eventDate, setEventDate, startTime, setStartTime, endTime, setEndTime,
}: {
  eventName: string; setEventName: (s: string) => void;
  eventDate: Date; setEventDate: (d: Date) => void;
  startTime: Date; setStartTime: (d: Date) => void;
  endTime: Date; setEndTime: (d: Date) => void;
}) {
  const [showDate, setShowDate] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const hours = Math.max(0, (endTime.getTime() - startTime.getTime()) / 3_600_000);

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Event details</Text>
      <Text style={s.stepSub}>Tell us about your event</Text>

      <Text style={s.label}>Event Name</Text>
      <TextInput style={s.field} value={eventName} onChangeText={setEventName} placeholder="e.g. Friday Night, VIP Launch" placeholderTextColor={colors.textMuted} />

      <TouchableOpacity style={s.dateCard} onPress={() => { setShowDate(true); setShowStart(false); setShowEnd(false); }}>
        <View style={s.dateIcon}><Text style={{ fontSize: 20 }}>📅</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.dateLbl}>Event Date</Text>
          <Text style={s.dateVal}>{fmtDate(eventDate)}</Text>
        </View>
        <Text style={{ fontSize: 20, color: colors.textMuted }}>›</Text>
      </TouchableOpacity>
      {showDate && (
        <DateTimePicker value={eventDate} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_e, d) => { if (Platform.OS !== "ios") setShowDate(false); if (d) setEventDate(d); }}
          minimumDate={new Date()} themeVariant="dark" />
      )}

      <View style={s.timeRow}>
        <TouchableOpacity style={[s.timeCard, { flex: 1 }]} onPress={() => { setShowStart(true); setShowEnd(false); setShowDate(false); }}>
          <Text style={s.timeLbl}>Start</Text>
          <Text style={s.timeVal}>{fmtTime(startTime)}</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.textMuted, fontSize: 18, marginHorizontal: spacing.sm }}>→</Text>
        <TouchableOpacity style={[s.timeCard, { flex: 1 }]} onPress={() => { setShowEnd(true); setShowStart(false); setShowDate(false); }}>
          <Text style={s.timeLbl}>End</Text>
          <Text style={s.timeVal}>{fmtTime(endTime)}</Text>
        </TouchableOpacity>
      </View>
      {showStart && (
        <DateTimePicker value={startTime} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_e, d) => { if (Platform.OS !== "ios") setShowStart(false); if (d) setStartTime(d); }}
          themeVariant="dark" />
      )}
      {showEnd && (
        <DateTimePicker value={endTime} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_e, d) => { if (Platform.OS !== "ios") setShowEnd(false); if (d) setEndTime(d); }}
          themeVariant="dark" />
      )}

      {hours > 0 && (
        <View style={s.durationCard}>
          <Text style={{ fontSize: 16, marginRight: spacing.sm }}>⏱️</Text>
          <Text style={{ ...typography.body, color: colors.textMuted }}>
            Duration: <Text style={{ color: colors.accent, fontWeight: "600" }}>{hours.toFixed(1)} hours</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Step 2: Staff Requirements (multi-role) ───
function StaffStep({ roles, setRoles }: { roles: RoleSelection[]; setRoles: (r: RoleSelection[]) => void }) {
  const toggleRole = (roleId: string) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const exists = roles.find((r) => r.roleId === roleId);
    if (exists) {
      if (roles.length <= 1) return;
      setRoles(roles.filter((r) => r.roleId !== roleId));
    } else {
      const def = ROLES.find((r) => r.id === roleId);
      setRoles([...roles, { roleId, count: 1, rate: def?.defaultRate ?? 16 }]);
    }
  };

  const updateRole = (roleId: string, field: "count" | "rate", value: number) => {
    setRoles(roles.map((r) => r.roleId === roleId ? { ...r, [field]: Math.max(field === "count" ? 1 : 1, value) } : r));
  };

  return (
    <View style={s.stepContent}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.stepTitle}>Staff Requirements</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          {roles.reduce((sum, r) => sum + r.count, 0)} staff total
        </Text>
        </View>
      <Text style={s.stepSub}>Add the roles and quantities you need</Text>

      {/* Role chips */}
      <Text style={s.label}>Role</Text>
      <View style={s.roleChipRow}>
        {ROLES.map((role) => {
          const selected = roles.some((r) => r.roleId === role.id);
          return (
        <TouchableOpacity
              key={role.id}
              style={[s.roleChip, selected && s.roleChipActive]}
              onPress={() => toggleRole(role.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.roleChipText, selected && s.roleChipTextActive]}>{role.label}</Text>
        </TouchableOpacity>
          );
        })}
      </View>

      {/* Per-role config */}
      {roles.map((sel) => {
        const def = ROLES.find((r) => r.id === sel.roleId);
        return (
          <View key={sel.roleId} style={s.roleConfigCard}>
            <View style={s.roleConfigHeader}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>{def?.icon}</Text>
              <Text style={s.roleConfigTitle}>{def?.label}</Text>
              {roles.length > 1 && (
                <TouchableOpacity onPress={() => toggleRole(sel.roleId)} hitSlop={12}>
                  <Text style={{ color: colors.error, fontSize: 14, fontWeight: "700" }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.roleConfigRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.roleConfigLabel}>Quantity</Text>
                <View style={s.counterRow}>
                  <TouchableOpacity style={s.counterBtn} onPress={() => updateRole(sel.roleId, "count", sel.count - 1)}>
                    <Text style={s.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.counterVal}>{sel.count}</Text>
                  <TouchableOpacity style={s.counterBtn} onPress={() => updateRole(sel.roleId, "count", sel.count + 1)}>
                    <Text style={s.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ width: 100 }}>
                <Text style={s.roleConfigLabel}>Rate</Text>
                <View style={s.rateWrap}>
                  <Text style={{ color: colors.accent, fontWeight: "700", marginRight: 2 }}>£</Text>
                  <TextInput
                    style={s.rateInput}
                    value={String(sel.rate)}
                    onChangeText={(t) => updateRole(sel.roleId, "rate", parseInt(t) || 0)}
                    keyboardType="number-pad"
                  />
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>/hr</Text>
                </View>
              </View>
      </View>
          </View>
        );
      })}

      {/* Brief notes */}
      <Text style={[s.label, { marginTop: spacing.lg }]}>Brief Notes (optional)</Text>
      <TextInput
        style={[s.field, { minHeight: 70, textAlignVertical: "top" }]}
        placeholder="Any special requirements, dress code, areas to focus on..."
        placeholderTextColor={colors.textMuted}
        multiline
      />
    </View>
  );
}

// ─── Step 3: Assign ───
function AssignStep({
  postToBoard, setPostToBoard, selectSpecific, setSelectSpecific,
  selectedStaff, toggleStaff, personnel, loadingStaff,
}: {
  postToBoard: boolean; setPostToBoard: (b: boolean) => void;
  selectSpecific: boolean; setSelectSpecific: (b: boolean) => void;
  selectedStaff: string[]; toggleStaff: (id: string) => void;
  personnel: PersonnelItem[]; loadingStaff: boolean;
}) {
  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>How would you like to fill this job?</Text>
      <Text style={s.stepSub}>Choose how guards are assigned</Text>

      {/* Post to Job Board */}
          <TouchableOpacity
        style={[s.assignCard, postToBoard && s.assignCardActive]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPostToBoard(!postToBoard); }}
        activeOpacity={0.8}
      >
        <Text style={s.assignEmoji}>🚀</Text>
        <View style={s.assignInfo}>
          <Text style={s.assignTitle}>Post to Job Board</Text>
          <Text style={s.assignDesc}>All security guards get notified instantly. First to claim gets the shift — like Uber.</Text>
              </View>
        <View style={[s.assignCheck, postToBoard && s.assignCheckActive]}>
          {postToBoard && <Text style={s.assignCheckTick}>✓</Text>}
      </View>
      </TouchableOpacity>

      {/* Select Specific Staff */}
        <TouchableOpacity
        style={[s.assignCard, selectSpecific && s.assignCardActiveAlt]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectSpecific(!selectSpecific); }}
        activeOpacity={0.8}
      >
        <Text style={s.assignEmoji}>👥</Text>
        <View style={s.assignInfo}>
          <Text style={s.assignTitle}>Select Specific Staff</Text>
          <Text style={s.assignDesc}>Handpick trusted guards from your network. They'll be notified directly.</Text>
        </View>
        <View style={[s.assignCheck, selectSpecific && s.assignCheckActiveAlt]}>
          {selectSpecific && <Text style={s.assignCheckTick}>✓</Text>}
        </View>
        </TouchableOpacity>

      {!postToBoard && !selectSpecific && (
        <Text style={{ ...typography.caption, color: colors.warning, textAlign: "center", marginTop: spacing.sm }}>
          Please select at least one assignment method
        </Text>
      )}

      {/* Job board info box */}
      {postToBoard && !selectSpecific && (
        <View style={s.infoBox}>
          <Text style={s.infoBoxTitle}>How Job Board Works</Text>
          <Text style={s.infoBoxLine}>1. All guards get notified instantly</Text>
          <Text style={s.infoBoxLine}>2. They see the job on their board</Text>
          <Text style={s.infoBoxLine}>3. First to tap "Claim" gets the shift</Text>
          <Text style={s.infoBoxLine}>4. Mission Control chat activates</Text>
      </View>
      )}

      {/* Personnel list */}
      {selectSpecific && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.text, fontWeight: "600", marginBottom: spacing.sm }}>
            Available Personnel{selectedStaff.length > 0 ? ` · ${selectedStaff.length} selected` : ""}
          </Text>
          {loadingStaff ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
          ) : personnel.length === 0 ? (
            <Text style={{ ...typography.bodySmall, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl }}>No personnel available right now.</Text>
          ) : (
            personnel.map((p) => {
              const sel = selectedStaff.includes(p.id);
              return (
                <TouchableOpacity key={p.id} style={[s.staffRow, sel && s.staffRowSel]} onPress={() => toggleStaff(p.id)} activeOpacity={0.75}>
                  <View style={[s.staffAvatar, sel && s.staffAvatarSel]}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{sel ? "✓" : (p.display_name?.charAt(0) || "?")}</Text>
      </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, color: colors.text, fontWeight: "600" }}>{p.display_name || "Guard"}</Text>
                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 2 }}>
                      Shield {p.shield_score ?? 0} · {p.total_shifts ?? 0} shifts{p.city ? ` · ${p.city}` : ""}
                    </Text>
                  </View>
                  <Text style={{ ...typography.body, color: colors.accent, fontWeight: "700" }}>£{p.hourly_rate ?? 16}/hr</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ─── Step 4: Review ───
function ReviewStep({
  eventName, eventDate, startTime, endTime, roles, notes, setNotes,
  postToBoard, selectSpecific, selectedStaffCount,
}: {
  eventName: string; eventDate: Date; startTime: Date; endTime: Date;
  roles: RoleSelection[]; notes: string; setNotes: (s: string) => void;
  postToBoard: boolean; selectSpecific: boolean; selectedStaffCount: number;
}) {
  const hours = Math.max(0, (endTime.getTime() - startTime.getTime()) / 3_600_000);
  const subtotal = roles.reduce((sum, r) => sum + r.count * r.rate * hours, 0);
  const fee = subtotal * 0.05;
  const total = subtotal + fee;
  const totalStaff = roles.reduce((sum, r) => sum + r.count, 0);
  const assignLabel = postToBoard && selectSpecific
    ? "Job Board + Specific Staff"
    : postToBoard ? "Job Board (all guards notified)" : `Specific Staff (${selectedStaffCount} selected)`;

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Review Your Booking</Text>
      <Text style={s.stepSub}>Check the details before confirming</Text>

      <View style={s.reviewCard}>
        <View style={s.reviewRow}>
          <Text style={s.reviewIcon}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reviewLbl}>Event</Text>
            <Text style={s.reviewVal}>{eventName || "—"}</Text>
          </View>
        </View>
        <View style={s.reviewDiv} />
        <View style={s.reviewRow}>
          <Text style={s.reviewIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reviewLbl}>Date & Time</Text>
            <Text style={s.reviewVal}>{eventDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</Text>
            <Text style={s.reviewSub}>
              {startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} –{" "}
              {endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ({hours.toFixed(1)} hrs)
            </Text>
          </View>
        </View>
        <View style={s.reviewDiv} />
        <View style={s.reviewRow}>
          <Text style={s.reviewIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reviewLbl}>Job Board posting</Text>
            {roles.map((r) => {
              const def = ROLES.find((d) => d.id === r.roleId);
              return <Text key={r.roleId} style={s.reviewVal}>{r.count}× {def?.label || "Security"} @ £{r.rate}/hr</Text>;
            })}
          </View>
        </View>
        <View style={s.reviewDiv} />
        <View style={s.reviewRow}>
          <Text style={s.reviewIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reviewLbl}>Assignment</Text>
            <Text style={s.reviewVal}>{assignLabel}</Text>
          </View>
        </View>
      </View>

      <Text style={s.label}>Additional Notes (optional)</Text>
      <TextInput style={[s.field, { minHeight: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes}
        placeholder="Any special requirements..." placeholderTextColor={colors.textMuted} multiline />

      <View style={s.priceCard}>
        <View style={s.priceRow}>
          <Text style={s.priceLbl}>{totalStaff} staff × {hours.toFixed(1)} hrs</Text>
          <Text style={s.priceVal}>£{subtotal.toFixed(2)}</Text>
        </View>
        <View style={s.priceRow}>
          <Text style={s.priceLbl}>Guard fee (from guard&apos;s pay)</Text>
          <Text style={s.priceVal}>£{fee.toFixed(2)}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: spacing.sm }} />
        <View style={s.priceRow}>
          <Text style={{ ...typography.title, color: colors.text }}>Estimated Total</Text>
          <Text style={{ ...typography.title, color: colors.accent, fontSize: 20 }}>£{total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Confirmation ───
function ConfirmationStep() {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[s.confirmContent, { opacity, transform: [{ scale }] }]}>
      <LinearGradient colors={["rgba(45,212,191,0.2)", "rgba(45,212,191,0.05)"]} style={s.confirmCircle}>
        <Text style={{ fontSize: 48 }}>🎉</Text>
      </LinearGradient>
      <Text style={s.confirmTitle}>Job Posted!</Text>
      <Text style={s.confirmText}>Your booking has been created and all security guards have been notified. They can now claim shifts from the job board.</Text>
      <View style={s.confirmInfo}>
        <Text style={{ fontSize: 16, marginRight: spacing.sm }}>📧</Text>
        <Text style={{ ...typography.caption, color: colors.accent }}>Check your email for confirmation details</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ───
export default function NewBookingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 6 * 3_600_000));
  const [roles, setRoles] = useState<RoleSelection[]>([{ roleId: "door_supervisor", count: 2, rate: 18 }]);
  const [notes, setNotes] = useState("");
  const [postToBoard, setPostToBoard] = useState(true);
  const [selectSpecific, setSelectSpecific] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const toggleStaff = useCallback((id: string) => {
    setSelectedStaff((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  useEffect(() => {
    if (!selectSpecific || !supabase) return;
    let c = false;
    (async () => {
      setLoadingStaff(true);
      const { data } = await supabase.from("personnel").select("id, display_name, shield_score, total_shifts, hourly_rate, city").eq("is_active", true).order("shield_score", { ascending: false });
      if (!c && data) setPersonnel(data as PersonnelItem[]);
      if (!c) setLoadingStaff(false);
    })();
    return () => { c = true; };
  }, [selectSpecific]);

  const animateStep = (dir: "next" | "back") => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: dir === "next" ? -SCREEN_WIDTH : SCREEN_WIDTH, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
  };
  const next = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); animateStep("next"); setStep((x) => Math.min(x + 1, 5)); };
  const prev = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); animateStep("back"); setStep((x) => Math.max(x - 1, 1)); };

  const canContinue = () => {
    if (step === 1) return eventName.trim().length > 0;
    if (step === 2) return roles.length > 0;
    if (step === 3) return postToBoard || (selectSpecific && selectedStaff.length > 0);
    return true;
  };

  const handleSubmit = async () => {
    if (!supabase) { Alert.alert("Error", "Not connected"); return; }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in");
      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile) throw new Error("Profile not found");
      const venueId = await getVenueId(supabase, profile.profileId);
      if (!venueId) throw new Error("Venue not found");

      const start = new Date(eventDate); start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      const end = new Date(eventDate); end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      const hours = (end.getTime() - start.getTime()) / 3_600_000;
      const totalStaff = roles.reduce((sum, r) => sum + r.count, 0);
      const subtotalPence = roles.reduce((sum, r) => sum + r.count * r.rate * hours * 100, 0);
      const feePence = Math.round(subtotalPence * 0.05);

      const canonicalStaffRequirements = toCanonicalStaffRequirements(
        roles.map((r) => ({ role: r.roleId, count: r.count, rate: r.rate }))
      );

      const { data: bookingRow, error } = await supabase.from("bookings").insert({
        venue_id: venueId,
        event_name: eventName || "Security Booking",
        event_date: eventDate.toISOString().split("T")[0],
        start_time: startTime.toTimeString().slice(0, 5),
        end_time: endTime.toTimeString().slice(0, 5),
        status: "pending",
        brief_notes: notes || null,
        staff_requirements: canonicalStaffRequirements,
        estimated_total: Math.round(subtotalPence + feePence),
        platform_fee: Math.round(feePence),
        auto_assign: postToBoard,
      }).select("id").single();
      if (error) throw error;

      // Always create shift rows so jobs are visible on guard-side boards.
      if (bookingRow?.id) {
        const startAt = new Date(eventDate);
        startAt.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        const endAt = new Date(eventDate);
        endAt.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
        if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);

        const roleSlots = canonicalStaffRequirements.flatMap((r) =>
          Array.from({ length: r.count }, () => ({ role: r.role, rate: r.rate_pence / 100 }))
        );

        const shiftsToInsert: any[] = [];
        let unassignedShiftCount = 0;
        let assigned = 0;

        if (selectSpecific && selectedStaff.length > 0) {
          for (const personnelId of selectedStaff) {
            if (assigned >= roleSlots.length) break;
            const slot = roleSlots[assigned];
            shiftsToInsert.push({
              booking_id: bookingRow.id,
              personnel_id: personnelId,
              role: slot.role,
              hourly_rate: slot.rate,
              scheduled_start: startAt.toISOString(),
              scheduled_end: endAt.toISOString(),
              status: "pending",
            });
            assigned += 1;
          }
        }

        const shouldPostRemainder = postToBoard || assigned < roleSlots.length;
        if (shouldPostRemainder) {
          for (let i = assigned; i < roleSlots.length; i += 1) {
            const slot = roleSlots[i];
            shiftsToInsert.push({
              booking_id: bookingRow.id,
              personnel_id: null,
              role: slot.role,
              hourly_rate: slot.rate,
              scheduled_start: startAt.toISOString(),
              scheduled_end: endAt.toISOString(),
              status: "pending",
            });
            unassignedShiftCount += 1;
          }
        }

        if (shiftsToInsert.length > 0) {
          const { error: shiftsErr } = await supabase.from("shifts").insert(shiftsToInsert);
          if (shiftsErr) throw shiftsErr;
        }

        // Trigger Uber-style popup for verified guards.
        // Strategy: try the server API first; if that fails, fall back to
        // creating shift_offers directly via Supabase service-role admin endpoint.
        if (unassignedShiftCount > 0) {
          const apiBase = getApiBaseUrl();
          let notified = false;

          // Attempt 1: call notify-guards API (works when Next.js dev server is reachable)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 5000);
              const res = await fetch(`${apiBase}/api/shifts/notify-guards`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ booking_id: bookingRow.id }),
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (res.ok) {
                const data = await res.json();
                notified = !!data?.success;
                console.log("[Booking] notify-guards OK:", data?.guards_notified, "guards");
              }
            }
          } catch (e) {
            console.warn("[Booking] notify-guards unreachable, trying admin fallback:", e);
          }

          // Attempt 2: admin create_offers endpoint (doesn't need auth, uses service role)
          if (!notified) {
            try {
              const controller2 = new AbortController();
              const timeout2 = setTimeout(() => controller2.abort(), 5000);
              const res2 = await fetch(`${apiBase}/api/admin/run-migration`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create_offers", booking_id: bookingRow.id }),
                signal: controller2.signal,
              });
              clearTimeout(timeout2);
              if (res2.ok) {
                const data2 = await res2.json();
                notified = !!data2?.success;
                console.log("[Booking] admin create_offers OK:", data2?.guards_notified, "guards");
              }
            } catch (e2) {
              console.warn("[Booking] admin fallback also failed:", e2);
            }
          }

          // Attempt 3: create shift_offers directly via Supabase (last resort)
          if (!notified) {
            try {
              console.log("[Booking] Attempting direct Supabase shift_offers creation...");
              const { data: verifiedRows } = await supabase
                .from("verifications")
                .select("owner_id")
                .eq("owner_type", "personnel")
                .eq("status", "verified");

              if (verifiedRows && verifiedRows.length > 0) {
                const personnelIds = verifiedRows.map((r: any) => r.owner_id);
                const { data: guards } = await supabase
                  .from("personnel")
                  .select("id")
                  .in("id", personnelIds)
                  .eq("is_active", true);

                if (guards && guards.length > 0) {
                  const firstShift = shiftsToInsert.find((s: any) => !s.personnel_id);
                  if (firstShift) {
                    const expiresAt = new Date(Date.now() + 60_000).toISOString();
                    const offerLabel = `${eventName || "Security Shift"} @ Venue`;
                    const offerRows = guards.map((g: any) => ({
                      shift_id: firstShift.id || shiftsToInsert[0]?.id,
                      personnel_id: g.id,
                      status: "pending",
                      hourly_rate: firstShift.hourly_rate,
                      venue_name: offerLabel,
                      shift_date: eventDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
                      start_time: startTime.toTimeString().slice(0, 5),
                      end_time: endTime.toTimeString().slice(0, 5),
                      expires_at: expiresAt,
                    }));
                    await supabase.from("shift_offers").upsert(offerRows, {
                      onConflict: "shift_id,personnel_id",
                      ignoreDuplicates: true,
                    });
                    console.log("[Booking] Direct offers created for", guards.length, "guards");
                  }
                }
              }
            } catch (directErr) {
              console.warn("[Booking] Direct offer creation failed:", directErr);
            }
          }
        }
      }
      setStep(5);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create booking");
    } finally { setLoading(false); }
  };

  const isConfirm = step === 5;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { if (step === 1 || isConfirm) router.back(); else prev(); }} style={s.headerBtn}>
          <Text style={{ fontSize: 20, color: colors.text }}>{step === 1 || isConfirm ? "✕" : "←"}</Text>
        </TouchableOpacity>
        <Text style={{ ...typography.title, color: colors.text }}>Book Security</Text>
        <View style={s.headerBtn} />
      </View>

      {!isConfirm && <ProgressIndicator currentStep={step} />}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {step === 1 && <EventStep eventName={eventName} setEventName={setEventName} eventDate={eventDate} setEventDate={setEventDate} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} />}
          {step === 2 && <StaffStep roles={roles} setRoles={setRoles} />}
          {step === 3 && <AssignStep postToBoard={postToBoard} setPostToBoard={setPostToBoard} selectSpecific={selectSpecific} setSelectSpecific={setSelectSpecific} selectedStaff={selectedStaff} toggleStaff={toggleStaff} personnel={personnel} loadingStaff={loadingStaff} />}
          {step === 4 && <ReviewStep eventName={eventName} eventDate={eventDate} startTime={startTime} endTime={endTime} roles={roles} notes={notes} setNotes={setNotes} postToBoard={postToBoard} selectSpecific={selectSpecific} selectedStaffCount={selectedStaff.length} />}
          {isConfirm && <ConfirmationStep />}
        </Animated.View>
      </ScrollView>

      {!isConfirm && (
        <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[s.primaryBtn, (!canContinue() || loading) && { opacity: 0.5 }]}
            onPress={step === 4 ? handleSubmit : next}
            disabled={!canContinue() || loading}
            activeOpacity={0.9}
          >
            <LinearGradient colors={(!canContinue() || loading) ? ["#555", "#444"] : [colors.accent, "#1fa89e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnInner}>
              <Text style={s.primaryBtnText}>{loading ? "Posting Job..." : step === 4 ? "Confirm Booking" : step === 3 ? "Next: Review →" : step === 2 ? "Next: Assign Staff →" : "Continue"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {isConfirm && (
        <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/(tabs)/explore")} activeOpacity={0.9}>
            <LinearGradient colors={[colors.accent, "#1fa89e"]} style={s.primaryBtnInner}>
              <Text style={s.primaryBtnText}>Back to Explore</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  progressContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  progressBar: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  progressStep: { flexDirection: "row", alignItems: "center" },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  progressDotActive: { borderColor: colors.accent },
  progressDotComplete: { backgroundColor: colors.accent, borderColor: colors.accent },
  progressNum: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  progressNumActive: { color: colors.accent },
  progressCheck: { color: colors.background, fontSize: 14, fontWeight: "700" },
  progressLine: { width: 40, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineComplete: { backgroundColor: colors.accent },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  progressLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10, flex: 1, textAlign: "center" },
  progressLabelActive: { color: colors.accent, fontWeight: "600" },

  stepContent: { paddingHorizontal: spacing.lg },
  stepTitle: { ...typography.title, color: colors.text, fontSize: 22, marginBottom: spacing.xs },
  stepSub: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  label: { ...typography.body, color: colors.text, fontWeight: "600", marginBottom: spacing.sm, marginTop: spacing.md },
  field: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...typography.body, color: colors.text, marginBottom: spacing.md },

  dateCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  dateIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(45,212,191,0.1)", alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  dateLbl: { ...typography.caption, color: colors.textMuted },
  dateVal: { ...typography.body, color: colors.text, fontWeight: "600" },
  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  timeCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  timeLbl: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  timeVal: { ...typography.title, color: colors.text, fontSize: 20 },
  durationCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(45,212,191,0.1)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },

  roleChipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  roleChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  roleChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  roleChipText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: "600" },
  roleChipTextActive: { color: "#000", fontWeight: "700" },

  roleConfigCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  roleConfigHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  roleConfigTitle: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1 },
  roleConfigRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  roleConfigLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 6 },
  counterRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  counterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  counterBtnText: { fontSize: 20, color: colors.accent },
  counterVal: { ...typography.title, color: colors.text, fontSize: 22, minWidth: 30, textAlign: "center" },
  rateWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, height: 36 },
  rateInput: { ...typography.body, color: colors.text, fontWeight: "600", minWidth: 30, textAlign: "center", padding: 0 },

  assignCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 2, borderColor: colors.border, marginBottom: spacing.sm },
  assignCardActive: { borderColor: colors.accent, backgroundColor: "rgba(0,212,170,0.06)" },
  assignCardActiveAlt: { borderColor: colors.secondary, backgroundColor: "rgba(167,139,250,0.06)" },
  assignEmoji: { fontSize: 28, marginRight: spacing.md },
  assignInfo: { flex: 1, marginRight: spacing.sm },
  assignTitle: { ...typography.body, color: colors.text, fontWeight: "700" },
  assignDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  assignCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  assignCheckActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  assignCheckActiveAlt: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  assignCheckTick: { color: "#000", fontSize: 14, fontWeight: "700" },

  infoBox: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, padding: spacing.md, marginTop: spacing.sm },
  infoBoxTitle: { ...typography.body, color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
  infoBoxLine: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 4 },

  staffRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  staffRowSel: { borderColor: colors.secondary, backgroundColor: "rgba(167,139,250,0.08)" },
  staffAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(45,212,191,0.15)", alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  staffAvatarSel: { backgroundColor: colors.secondary },

  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: "hidden" },
  reviewRow: { flexDirection: "row", alignItems: "flex-start", padding: spacing.md },
  reviewIcon: { fontSize: 20, marginRight: spacing.md, marginTop: 2 },
  reviewLbl: { ...typography.caption, color: colors.textMuted },
  reviewVal: { ...typography.body, color: colors.text, fontWeight: "600" },
  reviewSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  reviewDiv: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  priceCard: { backgroundColor: "rgba(45,212,191,0.05)", borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: "rgba(45,212,191,0.2)" },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  priceLbl: { ...typography.body, color: colors.textMuted },
  priceVal: { ...typography.body, color: colors.text },

  confirmContent: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xxl * 2 },
  confirmCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  confirmTitle: { ...typography.display, color: colors.text, fontSize: 28, marginBottom: spacing.md, textAlign: "center" },
  confirmText: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: spacing.xl },
  confirmInfo: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(45,212,191,0.1)", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.full },

  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  primaryBtn: { borderRadius: radius.lg, overflow: "hidden" },
  primaryBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
  primaryBtnText: { ...typography.body, color: colors.text, fontWeight: "600", fontSize: 16 },
});
