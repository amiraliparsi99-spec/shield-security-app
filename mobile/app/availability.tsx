import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import {
  PickDateCalendar,
  formatISODateUK,
} from "../components/availability/PickDateCalendar";
import { GuestGate } from "../components/auth/GuestGate";

type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface WeeklyAvailability {
  [key: string]: {
    available: boolean;
    startTime: string;
    endTime: string;
  };
}

interface DayConfig {
  key: DayOfWeek;
  label: string;
  /** DB: 0 = Sunday … 6 = Saturday */
  dow: number;
}

const DAYS: DayConfig[] = [
  { key: "monday", label: "Monday", dow: 1 },
  { key: "tuesday", label: "Tuesday", dow: 2 },
  { key: "wednesday", label: "Wednesday", dow: 3 },
  { key: "thursday", label: "Thursday", dow: 4 },
  { key: "friday", label: "Friday", dow: 5 },
  { key: "saturday", label: "Saturday", dow: 6 },
  { key: "sunday", label: "Sunday", dow: 0 },
];

const TIME_SLOTS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: { available: false, startTime: "18:00", endTime: "23:00" },
  tuesday: { available: false, startTime: "18:00", endTime: "23:00" },
  wednesday: { available: false, startTime: "18:00", endTime: "23:00" },
  thursday: { available: false, startTime: "18:00", endTime: "23:00" },
  friday: { available: true, startTime: "18:00", endTime: "23:00" },
  saturday: { available: true, startTime: "18:00", endTime: "23:00" },
  sunday: { available: false, startTime: "18:00", endTime: "23:00" },
};

type BlockedRow = { id: string; date: string; reason: string | null; isNew?: boolean };
type SpecialRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  isNew?: boolean;
};

function padTime(t: string): string {
  const s = (t || "09:00").slice(0, 5);
  return s.length === 5 ? s : "09:00";
}

/** Hours between start and end, handling past-midnight windows (e.g. 18:00–02:00). */
function windowHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let hours = eh + em / 60 - (sh + sm / 60);
  if (hours <= 0) hours += 24;
  return hours;
}

/** One-tap schedule presets so guards don't have to set each day by hand. */
const PRESETS: { id: string; label: string; icon: string; days: DayOfWeek[]; start: string; end: string }[] = [
  {
    id: "weekend",
    label: "Weekend nights",
    icon: "🌙",
    days: ["friday", "saturday"],
    start: "18:00",
    end: "03:00",
  },
  {
    id: "evenings",
    label: "Evenings",
    icon: "🌆",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    start: "18:00",
    end: "23:00",
  },
  {
    id: "daytime",
    label: "Weekday days",
    icon: "☀️",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    start: "09:00",
    end: "17:00",
  },
  {
    id: "all",
    label: "Open to anything",
    icon: "💪",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    start: "09:00",
    end: "23:00",
  },
];

function rowsToWeekly(
  rows: { day_of_week: number; is_available: boolean; start_time: string | null; end_time: string | null }[]
): WeeklyAvailability {
  const next: WeeklyAvailability = JSON.parse(JSON.stringify(DEFAULT_AVAILABILITY));
  for (const d of DAYS) {
    const row = rows.find((r) => r.day_of_week === d.dow);
    if (row) {
      next[d.key] = {
        available: !!row.is_available,
        startTime: padTime(row.start_time || "09:00"),
        endTime: padTime(row.end_time || "17:00"),
      };
    }
  }
  return next;
}

export default function AvailabilityScreen() {
  return (
    <GuestGate feature="availability" redirectAfter="/availability">
      <AvailabilityScreenContent />
    </GuestGate>
  );
}

function AvailabilityScreenContent() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<WeeklyAvailability>(DEFAULT_AVAILABILITY);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);

  const [blockedDates, setBlockedDates] = useState<BlockedRow[]>([]);
  const [removedBlockedIds, setRemovedBlockedIds] = useState<string[]>([]);
  const [selectedBlockedDate, setSelectedBlockedDate] = useState<string | null>(null);
  const [newBlockedReason, setNewBlockedReason] = useState("");

  const [specialRows, setSpecialRows] = useState<SpecialRow[]>([]);
  const [removedSpecialIds, setRemovedSpecialIds] = useState<string[]>([]);
  const [selectedSpecialDate, setSelectedSpecialDate] = useState<string | null>(null);
  const [spStart, setSpStart] = useState("18:00");
  const [spEnd, setSpEnd] = useState("23:00");
  const [spNote, setSpNote] = useState("");

  const loadAvailability = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const profile = await getProfileIdAndRole(supabase, user.id);
    if (!profile) {
      setLoading(false);
      return;
    }

    const pid = await getPersonnelId(supabase, profile.profileId);
    if (!pid) {
      setLoading(false);
      return;
    }

    setPersonnelId(pid);

    const [{ data: availData }, { data: blockedData }, { data: specialData }] = await Promise.all([
      supabase
        .from("availability")
        .select("day_of_week, is_available, start_time, end_time")
        .eq("personnel_id", pid),
      supabase.from("blocked_dates").select("id, date, reason").eq("personnel_id", pid),
      supabase
        .from("special_availability")
        .select("id, date, start_time, end_time, note")
        .eq("personnel_id", pid),
    ]);

    if (availData && availData.length > 0) {
      setAvailability(rowsToWeekly(availData as any));
    } else {
      setAvailability({ ...DEFAULT_AVAILABILITY });
    }

    setBlockedDates(
      (blockedData || []).map((b: any) => ({
        id: b.id,
        date: b.date,
        reason: b.reason ?? null,
      }))
    );
    setRemovedBlockedIds([]);

    setSpecialRows(
      (specialData || []).map((s: any) => ({
        id: s.id,
        date: s.date,
        start_time: padTime(s.start_time),
        end_time: padTime(s.end_time),
        note: s.note ?? null,
      }))
    );
    setRemovedSpecialIds([]);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const toggleDay = (day: DayOfWeek) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        available: !prev[day].available,
      },
    }));
  };

  const updateTime = (day: DayOfWeek, field: "startTime" | "endTime", value: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setAvailability((prev) => {
      const next: WeeklyAvailability = { ...prev };
      for (const d of DAYS) {
        const on = preset.days.includes(d.key);
        next[d.key] = {
          available: on,
          startTime: on ? preset.start : prev[d.key].startTime,
          endTime: on ? preset.end : prev[d.key].endTime,
        };
      }
      return next;
    });
    setSelectedDay(null);
  };

  const blockedDateMarkers = useMemo(
    () => new Set(blockedDates.map((b) => b.date)),
    [blockedDates]
  );
  const specialDateMarkers = useMemo(
    () => new Set(specialRows.map((s) => s.date)),
    [specialRows]
  );

  const addBlockedDateLocal = () => {
    const d = selectedBlockedDate;
    if (!d) {
      Alert.alert("Pick a date", "Tap a day on the calendar to block it.");
      return;
    }
    if (blockedDates.some((b) => b.date === d)) {
      Alert.alert("Already added", "That date is already blocked.");
      return;
    }
    setBlockedDates((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, date: d, reason: newBlockedReason.trim() || null, isNew: true },
    ]);
    setSelectedBlockedDate(null);
    setNewBlockedReason("");
  };

  const removeBlocked = (id: string) => {
    if (id.startsWith("new-")) {
      setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    } else {
      setRemovedBlockedIds((prev) => [...prev, id]);
      setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const addSpecialLocal = () => {
    const d = selectedSpecialDate;
    if (!d) {
      Alert.alert("Pick a date", "Tap a day on the calendar for special hours.");
      return;
    }
    if (specialRows.some((s) => s.date === d)) {
      Alert.alert("Already added", "You already have special hours for that date.");
      return;
    }
    setSpecialRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        date: d,
        start_time: spStart,
        end_time: spEnd,
        note: spNote.trim() || null,
        isNew: true,
      },
    ]);
    setSelectedSpecialDate(null);
    setSpNote("");
  };

  const removeSpecial = (id: string) => {
    if (id.startsWith("new-")) {
      setSpecialRows((prev) => prev.filter((s) => s.id !== id));
    } else {
      setRemovedSpecialIds((prev) => [...prev, id]);
      setSpecialRows((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const saveAvailability = async () => {
    if (!supabase || !personnelId) {
      Alert.alert("Error", "Not signed in as personnel.");
      return;
    }

    setSaving(true);
    try {
      const weeklyRows = DAYS.map((d) => {
        const slot = availability[d.key];
        return {
          personnel_id: personnelId,
          day_of_week: d.dow,
          is_available: slot.available,
          start_time: slot.available ? `${slot.startTime}:00` : null,
          end_time: slot.available ? `${slot.endTime}:00` : null,
        };
      });

      const { error: weeklyErr } = await supabase.from("availability").upsert(weeklyRows, {
        onConflict: "personnel_id,day_of_week",
      });
      if (weeklyErr) throw weeklyErr;

      for (const id of removedBlockedIds) {
        const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
        if (error) throw error;
      }

      const toInsertBlocked = blockedDates.filter((b) => b.isNew);
      if (toInsertBlocked.length > 0) {
        const { error } = await supabase.from("blocked_dates").insert(
          toInsertBlocked.map((b) => ({
            personnel_id: personnelId,
            date: b.date,
            reason: b.reason,
          }))
        );
        if (error) throw error;
      }

      for (const id of removedSpecialIds) {
        const { error } = await supabase.from("special_availability").delete().eq("id", id);
        if (error) throw error;
      }

      const toUpsertSpecial = specialRows.filter((s) => s.isNew);
      for (const s of toUpsertSpecial) {
        const { error } = await supabase.from("special_availability").upsert(
          {
            personnel_id: personnelId,
            date: s.date,
            start_time: `${s.start_time}:00`,
            end_time: `${s.end_time}:00`,
            note: s.note,
          },
          { onConflict: "personnel_id,date" }
        );
        if (error) throw error;
      }

      await loadAvailability();
      Alert.alert("Saved", "Your availability, blocked dates, and special hours were updated.");
    } catch (e: any) {
      console.error("Failed to save availability:", e);
      Alert.alert("Could not save", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const availableDaysCount = DAYS.filter((d) => availability[d.key].available).length;
  const weeklyHours = DAYS.reduce((sum, d) => {
    const slot = availability[d.key];
    return slot.available ? sum + windowHours(slot.startTime, slot.endTime) : sum;
  }, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Availability</Text>
        <TouchableOpacity onPress={saveAvailability} disabled={saving} activeOpacity={0.7}>
          <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary hero */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            {availableDaysCount === 0 ? "You're marked as unavailable" : "Your week at a glance"}
          </Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{availableDaysCount}</Text>
              <Text style={styles.summaryStatLabel}>
                day{availableDaysCount !== 1 ? "s" : ""} available
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{Math.round(weeklyHours)}</Text>
              <Text style={styles.summaryStatLabel}>hours per week</Text>
            </View>
          </View>
          <View style={styles.summaryDots}>
            {DAYS.map((d) => (
              <View key={d.key} style={styles.summaryDayWrap}>
                <View
                  style={[
                    styles.summaryDot,
                    availability[d.key].available && styles.summaryDotOn,
                  ]}
                />
                <Text style={styles.summaryDayLetter}>{d.label[0]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick presets */}
        <Text style={styles.presetLabel}>Quick set</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={{ paddingRight: spacing.lg }}
        >
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              style={styles.presetChip}
              onPress={() => applyPreset(preset)}
              activeOpacity={0.75}
            >
              <Text style={styles.presetIcon}>{preset.icon}</Text>
              <Text style={styles.presetText}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {DAYS.map((day) => {
          const dayData = availability[day.key];
          const isExpanded = selectedDay === day.key;

          return (
            <View key={day.key} style={[styles.dayCard, dayData.available && styles.dayCardOn]}>
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => {
                  if (dayData.available) {
                    setSelectedDay(isExpanded ? null : day.key);
                  } else {
                    toggleDay(day.key);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dayInfo}>
                  <Text style={[styles.dayLabel, !dayData.available && styles.dayLabelOff]}>
                    {day.label}
                  </Text>
                  {dayData.available ? (
                    <Text style={styles.dayTime}>
                      {dayData.startTime} – {dayData.endTime} · tap to change
                    </Text>
                  ) : (
                    <Text style={styles.dayTimeOff}>Not available</Text>
                  )}
                </View>
                <Switch
                  value={dayData.available}
                  onValueChange={() => toggleDay(day.key)}
                  trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.surfaceElevated}
                />
              </TouchableOpacity>

              {isExpanded && dayData.available && (
                <View style={styles.timeSelector}>
                  <Text style={styles.timeSelectorLabel}>Start time</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.timeScroll}
                  >
                    {TIME_SLOTS.map((time) => (
                      <TouchableOpacity
                        key={`start-${time}`}
                        style={[
                          styles.timeChip,
                          dayData.startTime === time && styles.timeChipActive,
                        ]}
                        onPress={() => updateTime(day.key, "startTime", time)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.timeChipText,
                            dayData.startTime === time && styles.timeChipTextActive,
                          ]}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[styles.timeSelectorLabel, { marginTop: spacing.md }]}>End time</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.timeScroll}
                  >
                    {[...TIME_SLOTS, "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"].map(
                      (time) => (
                        <TouchableOpacity
                          key={`end-${time}`}
                          style={[
                            styles.timeChip,
                            dayData.endTime === time && styles.timeChipActive,
                          ]}
                          onPress={() => updateTime(day.key, "endTime", time)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.timeChipText,
                              dayData.endTime === time && styles.timeChipTextActive,
                            ]}
                          >
                            {time}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.sectionHeading}>Blocked dates</Text>
        <Text style={styles.sectionHint}>
          Whole days you cannot work (holidays, appointments). Shifts on these dates won&apos;t be
          offered. Red dots = already blocked; purple = special hours elsewhere.
        </Text>
        <View style={styles.formCard}>
          <PickDateCalendar
            selectedDate={selectedBlockedDate}
            onSelectDate={setSelectedBlockedDate}
            blockedMarkers={blockedDateMarkers}
            specialMarkers={specialDateMarkers}
          />
          <Text style={styles.selectedDateLine}>
            {selectedBlockedDate
              ? `Selected: ${formatISODateUK(selectedBlockedDate)}`
              : "Tap a date on the calendar to block it"}
          </Text>
          <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Reason (optional)</Text>
          <TextInput
            style={styles.textInput}
            value={newBlockedReason}
            onChangeText={setNewBlockedReason}
            placeholder="Holiday"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addBlockedDateLocal} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>Add blocked date</Text>
          </TouchableOpacity>
        </View>
        {blockedDates.map((b) => (
          <View key={b.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listRowTitle}>{formatISODateUK(b.date)}</Text>
              {b.reason ? (
                <Text style={styles.listRowSub}>{b.reason}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => removeBlocked(b.id)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionHeading}>Special availability</Text>
        <Text style={styles.sectionHint}>
          One-off hours on a specific date (overrides your usual weekly hours for that day). Dots
          match your list below.
        </Text>
        <View style={styles.formCard}>
          <PickDateCalendar
            selectedDate={selectedSpecialDate}
            onSelectDate={setSelectedSpecialDate}
            blockedMarkers={blockedDateMarkers}
            specialMarkers={specialDateMarkers}
          />
          <Text style={styles.selectedDateLine}>
            {selectedSpecialDate
              ? `Selected: ${formatISODateUK(selectedSpecialDate)}`
              : "Tap a date for one-off availability hours"}
          </Text>
          <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Note (optional)</Text>
          <TextInput
            style={styles.textInput}
            value={spNote}
            onChangeText={setSpNote}
            placeholder="Extra cover"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.inputLabel, { marginTop: spacing.sm }]}>Time window</Text>
          <View style={styles.inlineRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {TIME_SLOTS.map((t) => (
                <TouchableOpacity
                  key={`sp-s-${t}`}
                  style={[styles.miniChip, spStart === t && styles.miniChipOn]}
                  onPress={() => setSpStart(t)}
                >
                  <Text style={[styles.miniChipText, spStart === t && styles.miniChipTextOn]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={[styles.inlineRow, { marginTop: spacing.xs }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {[...TIME_SLOTS, "00:00", "01:00", "02:00", "03:00"].map((t) => (
                <TouchableOpacity
                  key={`sp-e-${t}`}
                  style={[styles.miniChip, spEnd === t && styles.miniChipOn]}
                  onPress={() => setSpEnd(t)}
                >
                  <Text style={[styles.miniChipText, spEnd === t && styles.miniChipTextOn]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={addSpecialLocal} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>Add special day</Text>
          </TouchableOpacity>
        </View>
        {specialRows.map((s) => (
          <View key={s.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listRowTitle}>
                {formatISODateUK(s.date)} · {s.start_time}–{s.end_time}
              </Text>
              {s.note ? <Text style={styles.listRowSub}>{s.note}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => removeSpecial(s.id)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tips</Text>
          <Text style={styles.infoText}>
            • Save applies weekly hours, blocked dates, and special days together{"\n"}• Blocked dates
            always win over weekly hours{"\n"}• Special availability overrides the usual window for
            that date{"\n"}• You can still accept or decline individual shift offers
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.titleCard,
    color: colors.text,
  },
  saveButton: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + "40",
  },
  summaryTitle: {
    ...typography.titleCard,
    color: colors.accent,
    textAlign: "center",
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  summaryStat: {
    alignItems: "center",
  },
  summaryStatValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
  },
  summaryStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.accent + "40",
  },
  summaryDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
  },
  summaryDayWrap: {
    alignItems: "center",
    gap: 4,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  summaryDotOn: {
    backgroundColor: colors.success,
  },
  summaryDayLetter: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  presetLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  presetScroll: {
    marginBottom: spacing.lg,
    flexGrow: 0,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  presetIcon: {
    fontSize: 14,
  },
  presetText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  sectionHeading: {
    ...typography.titleCard,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedDateLine: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  addBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  addBtnText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listRowTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  listRowSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: "600",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniChipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  miniChipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },
  miniChipTextOn: {
    color: colors.text,
    fontWeight: "700",
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  dayCardOn: {
    borderColor: colors.accent + "50",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  dayInfo: {
    flex: 1,
  },
  dayLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  dayLabelOff: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  dayTime: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  dayTimeOff: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  timeSelector: {
    padding: spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timeSelectorLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  timeScroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.xs,
  },
  timeChipActive: {
    backgroundColor: colors.accent,
  },
  timeChipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },
  timeChipTextActive: {
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  infoTitle: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
