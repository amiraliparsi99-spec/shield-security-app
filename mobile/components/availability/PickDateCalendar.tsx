import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODateString(y: number, monthIndex0: number, day: number) {
  return `${y}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

type Cell = { day: number | null; iso: string | null };

type Props = {
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
  /** Dates already marked as blocked (shows dot). */
  blockedMarkers: Set<string>;
  /** Dates with special availability (shows dot). */
  specialMarkers: Set<string>;
};

export function PickDateCalendar({
  selectedDate,
  onSelectDate,
  blockedMarkers,
  specialMarkers,
}: Props) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth0, setViewMonth0] = useState(() => new Date().getMonth());

  const { rows, monthTitle } = useMemo(() => {
    const first = new Date(viewYear, viewMonth0, 1);
    const startPad = (first.getDay() + 6) % 7;
    const dim = new Date(viewYear, viewMonth0 + 1, 0).getDate();
    const cells: Cell[] = [];
    for (let i = 0; i < startPad; i++) {
      cells.push({ day: null, iso: null });
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ day: d, iso: toISODateString(viewYear, viewMonth0, d) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, iso: null });
    }
    const rowChunks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rowChunks.push(cells.slice(i, i + 7));
    }
    const title = new Date(viewYear, viewMonth0, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    return { rows: rowChunks, monthTitle: title };
  }, [viewYear, viewMonth0]);

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMonth0 === 0) {
      setViewMonth0(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth0((m) => m - 1);
    }
  };

  const nextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMonth0 === 11) {
      setViewMonth0(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth0((m) => m + 1);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={12} style={styles.navBtn} accessibilityLabel="Previous month">
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthTitle}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={12} style={styles.navBtn} accessibilityLabel="Next month">
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {WEEK_LABELS.map((w) => (
          <Text key={w} style={styles.weekLabel}>
            {w}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((cell, ci) => {
            if (cell.day === null || !cell.iso) {
              return <View key={`empty-${ri}-${ci}`} style={styles.cell} />;
            }
            const iso = cell.iso;
            const selected = selectedDate === iso;
            const hasB = blockedMarkers.has(iso);
            const hasS = specialMarkers.has(iso);
            return (
              <TouchableOpacity
                key={iso}
                style={[styles.cell, styles.cellBtn, selected && styles.cellSelected]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelectDate(iso);
                }}
                activeOpacity={0.75}
                accessibilityLabel={`${cell.day} ${monthTitle}`}
              >
                <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{cell.day}</Text>
                <View style={styles.dots}>
                  {hasB ? <View style={[styles.dot, styles.dotBlocked]} /> : null}
                  {hasS ? <View style={[styles.dot, styles.dotSpecial]} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function formatISODateUK(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  navBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 44,
    alignItems: "center",
  },
  navBtnText: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: "300",
  },
  monthTitle: {
    ...typography.titleCard,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    marginHorizontal: 1,
  },
  cellBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  cellSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dayNum: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
    fontSize: 14,
  },
  dayNumSelected: {
    color: colors.accent,
  },
  dots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
    height: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotBlocked: {
    backgroundColor: colors.error,
  },
  dotSpecial: {
    backgroundColor: colors.secondary,
  },
});
