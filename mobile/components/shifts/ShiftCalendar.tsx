import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');

interface Shift {
  id: string;
  venue: string;
  date: string; // ISO date string
  startTime: string;
  endTime: string;
  rate: number;
  status: 'confirmed' | 'pending' | 'completed';
  type: 'door' | 'event' | 'corporate' | 'retail';
}

interface ShiftCalendarProps {
  shifts: Shift[];
  onShiftPress?: (shift: Shift) => void;
  onDatePress?: (date: Date) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Adjust for Monday start
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

const STATUS_COLORS = {
  confirmed: colors.success,
  pending: colors.warning,
  completed: colors.textMuted,
};

const TYPE_EMOJIS = {
  door: '🚪',
  event: '🎉',
  corporate: '🏢',
  retail: '🛒',
};

export function ShiftCalendar({ shifts, onShiftPress, onDatePress }: ShiftCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date): Shift[] => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return isSameDay(shiftDate, date);
    });
  };

  // Get shifts for selected date
  const selectedDateShifts = useMemo(() => {
    if (!selectedDate) return [];
    return getShiftsForDate(selectedDate);
  }, [selectedDate, shifts]);

  // Navigate months
  const goToPreviousMonth = () => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -1, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
    
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
    
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(today);
  };

  const handleDatePress = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    onDatePress?.(date);
  };

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    
    // Add empty slots for days before first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [currentYear, currentMonth, daysInMonth, firstDayOfMonth]);

  const renderDay = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const date = new Date(currentYear, currentMonth, day);
    const isToday = isSameDay(date, today);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const dayShifts = getShiftsForDate(date);
    const hasShifts = dayShifts.length > 0;
    const isPast = date < today && !isToday;

    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          isSelected && styles.dayCellSelected,
          isToday && !isSelected && styles.dayCellToday,
        ]}
        onPress={() => handleDatePress(day)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayText,
          isSelected && styles.dayTextSelected,
          isToday && styles.dayTextToday,
          isPast && styles.dayTextPast,
        ]}>
          {day}
        </Text>
        
        {/* Shift indicators */}
        {hasShifts && (
          <View style={styles.shiftIndicators}>
            {dayShifts.slice(0, 3).map((shift, i) => (
              <View
                key={shift.id}
                style={[
                  styles.shiftDot,
                  { backgroundColor: STATUS_COLORS[shift.status] }
                ]}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday} style={styles.monthYearButton}>
          <Animated.View style={{
            transform: [{
              translateX: slideAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-20, 0, 20]
              })
            }]
          }}>
            <Text style={styles.monthText}>{MONTHS[currentMonth]}</Text>
            <Text style={styles.yearText}>{currentYear}</Text>
          </Animated.View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Day Labels */}
      <View style={styles.dayLabels}>
        {DAYS.map((day, index) => (
          <View key={day} style={styles.dayLabelCell}>
            <Text style={[
              styles.dayLabel,
              (index === 5 || index === 6) && styles.dayLabelWeekend
            ]}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => renderDay(day, index))}
      </View>

      {/* Selected Date Shifts */}
      <View style={styles.shiftsSection}>
        <View style={styles.shiftsSectionHeader}>
          <Text style={styles.shiftsSectionTitle}>
            {selectedDate ? (
              isSameDay(selectedDate, today) 
                ? 'Today' 
                : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
            ) : 'Select a date'}
          </Text>
          <Text style={styles.shiftsCount}>
            {selectedDateShifts.length} shift{selectedDateShifts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <ScrollView 
          style={styles.shiftsList} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.shiftsListContent}
        >
          {selectedDateShifts.length === 0 ? (
            <View style={styles.noShifts}>
              <Text style={styles.noShiftsEmoji}>📅</Text>
              <Text style={styles.noShiftsText}>No shifts scheduled</Text>
              <Text style={styles.noShiftsSubtext}>Explore available shifts</Text>
            </View>
          ) : (
            selectedDateShifts.map((shift) => (
              <TouchableOpacity
                key={shift.id}
                style={styles.shiftCard}
                onPress={() => onShiftPress?.(shift)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[
                    STATUS_COLORS[shift.status] + '15',
                    STATUS_COLORS[shift.status] + '05',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shiftCardGradient}
                >
                  <View style={styles.shiftCardHeader}>
                    <View style={styles.shiftCardLeft}>
                      <Text style={styles.shiftEmoji}>{TYPE_EMOJIS[shift.type]}</Text>
                      <View>
                        <Text style={styles.shiftVenue}>{shift.venue}</Text>
                        <Text style={styles.shiftTime}>
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.shiftCardRight}>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[shift.status] + '30' }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[shift.status] }]}>
                          {shift.status}
                        </Text>
                      </View>
                      <Text style={styles.shiftRate}>£{shift.rate}/hr</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Confirmed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Pending</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
      </View>
    </View>
  );
}

const cellSize = (width - spacing.lg * 2) / 7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 20,
    color: colors.text,
  },
  monthYearButton: {
    alignItems: 'center',
  },
  monthText: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  yearText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  dayLabelCell: {
    width: cellSize,
    alignItems: 'center',
  },
  dayLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  dayLabelWeekend: {
    color: colors.accent,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
  },
  dayCell: {
    width: cellSize,
    height: cellSize,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: cellSize / 2,
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dayText: {
    ...typography.body,
    color: colors.text,
  },
  dayTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  dayTextToday: {
    color: colors.accent,
    fontWeight: '600',
  },
  dayTextPast: {
    color: colors.textMuted,
  },
  shiftIndicators: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  shiftDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  shiftsSection: {
    flex: 1,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  shiftsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shiftsSectionTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  shiftsCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  shiftsList: {
    flex: 1,
  },
  shiftsListContent: {
    paddingBottom: spacing.xl,
  },
  noShifts: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  noShiftsEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noShiftsText: {
    ...typography.body,
    color: colors.textMuted,
  },
  noShiftsSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  shiftCard: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  shiftCardGradient: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shiftEmoji: {
    fontSize: 28,
  },
  shiftVenue: {
    ...typography.titleCard,
    color: colors.text,
  },
  shiftTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  shiftCardRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  statusText: {
    ...typography.captionMuted,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  shiftRate: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
