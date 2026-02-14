import { router } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShiftCalendar } from "../components/shifts";
import { colors, typography, spacing, radius } from "../theme";

interface Shift {
  id: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  rate: number;
  status: 'confirmed' | 'pending' | 'completed';
  type: 'door' | 'event' | 'corporate' | 'retail';
}

// Sample shifts data - in real app, fetch from Supabase
const SAMPLE_SHIFTS: Shift[] = [
  {
    id: '1',
    venue: 'The Night Owl',
    date: new Date().toISOString(),
    startTime: '21:00',
    endTime: '03:00',
    rate: 15,
    status: 'confirmed',
    type: 'door',
  },
  {
    id: '2',
    venue: 'PRYZM Birmingham',
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    startTime: '20:00',
    endTime: '04:00',
    rate: 16,
    status: 'confirmed',
    type: 'event',
  },
  {
    id: '3',
    venue: 'Lab11',
    date: new Date(Date.now() + 86400000 * 2).toISOString(), // Day after tomorrow
    startTime: '22:00',
    endTime: '04:00',
    rate: 15,
    status: 'pending',
    type: 'door',
  },
  {
    id: '4',
    venue: 'The Mailbox',
    date: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
    startTime: '09:00',
    endTime: '17:00',
    rate: 14,
    status: 'pending',
    type: 'corporate',
  },
  {
    id: '5',
    venue: 'The Night Owl',
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    startTime: '21:00',
    endTime: '03:00',
    rate: 15,
    status: 'completed',
    type: 'door',
  },
  {
    id: '6',
    venue: 'O2 Academy',
    date: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    startTime: '18:00',
    endTime: '23:00',
    rate: 18,
    status: 'completed',
    type: 'event',
  },
];

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [shifts, setShifts] = useState(SAMPLE_SHIFTS);

  const handleShiftPress = (shift: Shift) => {
    router.push(`/shift/${shift.id}`);
  };

  const handleDatePress = (date: Date) => {
    console.log('Date pressed:', date);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Calendar</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {shifts.filter(s => s.status === 'confirmed').length}
          </Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={[styles.statItem, styles.statItemBorder]}>
          <Text style={styles.statValue}>
            {shifts.filter(s => s.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {shifts.filter(s => s.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Calendar */}
      <ShiftCalendar
        shifts={shifts}
        onShiftPress={handleShiftPress}
        onDatePress={handleDatePress}
      />
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
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  headerRight: {
    width: 60,
  },
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    ...typography.title,
    color: colors.accent,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
