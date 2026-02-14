import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface WeeklyAvailability {
  [key: string]: {
    available: boolean;
    startTime: string;
    endTime: string;
  };
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: { available: false, startTime: '18:00', endTime: '23:00' },
  tuesday: { available: false, startTime: '18:00', endTime: '23:00' },
  wednesday: { available: false, startTime: '18:00', endTime: '23:00' },
  thursday: { available: false, startTime: '18:00', endTime: '23:00' },
  friday: { available: true, startTime: '18:00', endTime: '03:00' },
  saturday: { available: true, startTime: '18:00', endTime: '03:00' },
  sunday: { available: false, startTime: '18:00', endTime: '23:00' },
};

export default function AvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<WeeklyAvailability>(DEFAULT_AVAILABILITY);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);

  const loadAvailability = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
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

    // Load availability from database
    const { data } = await supabase
      .from('availability')
      .select('*')
      .eq('personnel_id', pid)
      .eq('type', 'weekly')
      .single();

    if (data?.schedule) {
      setAvailability(data.schedule as WeeklyAvailability);
    }

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

  const updateTime = (day: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
    setSelectedDay(null);
  };

  const saveAvailability = async () => {
    if (!supabase || !personnelId) return;

    setSaving(true);

    // Upsert availability
    const { error } = await supabase
      .from('availability')
      .upsert({
        personnel_id: personnelId,
        type: 'weekly',
        schedule: availability,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'personnel_id,type',
      });

    setSaving(false);

    if (error) {
      console.error('Failed to save availability:', error);
    } else {
      router.back();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Availability</Text>
        <TouchableOpacity onPress={saveAvailability} disabled={saving} activeOpacity={0.7}>
          <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Weekly Schedule</Text>
          <Text style={styles.summaryText}>
            {availableDaysCount === 0
              ? 'No days set as available'
              : `Available ${availableDaysCount} day${availableDaysCount !== 1 ? 's' : ''} per week`}
          </Text>
        </View>

        {/* Day Cards */}
        {DAYS.map((day) => {
          const dayData = availability[day.key];
          const isExpanded = selectedDay === day.key;

          return (
            <View key={day.key} style={styles.dayCard}>
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => toggleDay(day.key)}
                activeOpacity={0.7}
              >
                <View style={styles.dayInfo}>
                  <View
                    style={[
                      styles.dayIndicator,
                      dayData.available && styles.dayIndicatorActive,
                    ]}
                  />
                  <Text style={styles.dayLabel}>{day.label}</Text>
                </View>
                <View style={styles.dayActions}>
                  {dayData.available && (
                    <Text style={styles.dayTime}>
                      {dayData.startTime} - {dayData.endTime}
                    </Text>
                  )}
                  <Text style={styles.dayToggle}>
                    {dayData.available ? '✓' : '○'}
                  </Text>
                </View>
              </TouchableOpacity>

              {dayData.available && (
                <TouchableOpacity
                  style={styles.editTimes}
                  onPress={() => setSelectedDay(isExpanded ? null : day.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editTimesText}>
                    {isExpanded ? 'Hide times' : 'Edit times'}
                  </Text>
                </TouchableOpacity>
              )}

              {isExpanded && dayData.available && (
                <View style={styles.timeSelector}>
                  <Text style={styles.timeSelectorLabel}>Start Time</Text>
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
                        onPress={() => updateTime(day.key, 'startTime', time)}
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

                  <Text style={[styles.timeSelectorLabel, { marginTop: spacing.md }]}>
                    End Time
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.timeScroll}
                  >
                    {[...TIME_SLOTS, '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'].map((time) => (
                      <TouchableOpacity
                        key={`end-${time}`}
                        style={[
                          styles.timeChip,
                          dayData.endTime === time && styles.timeChipActive,
                        ]}
                        onPress={() => updateTime(day.key, 'endTime', time)}
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
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })}

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Tips</Text>
          <Text style={styles.infoText}>
            • Set your regular weekly availability{'\n'}
            • Venues and agencies can see when you're free{'\n'}
            • You can still accept or decline individual shifts{'\n'}
            • Update anytime if your schedule changes
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
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
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
    borderColor: colors.accent + '40',
  },
  summaryTitle: {
    ...typography.titleCard,
    color: colors.accent,
  },
  summaryText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.xs,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginRight: spacing.sm,
  },
  dayIndicatorActive: {
    backgroundColor: colors.success,
  },
  dayLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  dayToggle: {
    ...typography.body,
    color: colors.accent,
    fontSize: 18,
  },
  editTimes: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  editTimesText: {
    ...typography.caption,
    color: colors.accent,
    textAlign: 'center',
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
    fontWeight: '500',
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
