import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { HOME } from '@/constants/copy';

interface DatePickerProps {
  /** `YYYY-MM-DD`. */
  value: string;
  /** Every day of the month being written into. */
  monthKey: string;
  onChange: (occurredOn: string) => void;
  /** Days after this are not offered. Absent on a month already past. */
  latest?: string | undefined;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function daysIn(monthKey: string): string[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: last },
    (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`
  );
}

/**
 * Which day the record belongs to.
 *
 * A record used to always be today, and the composer was hidden on any other
 * month so that looking at June could not silently write into June. Naming
 * the day is what makes the other months safe to write into: backdating is
 * now something the person does on purpose and can see, rather than
 * something the screen decides for them.
 *
 * Days ahead of today are not offered. A record is something that happened.
 */
export function DatePicker({ value, monthKey, onChange, latest }: DatePickerProps) {
  const days = useMemo(
    () => daysIn(monthKey).filter((day) => !latest || day <= latest),
    [monthKey, latest]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{HOME.date}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        testID="date-picker"
      >
        {days.map((day) => {
          const chosen = day === value;
          const weekday = WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
          return (
            <Pressable
              key={day}
              testID={`day-${day}`}
              onPress={() => onChange(day)}
              hitSlop={HIT_SLOP}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={day}
              style={({ pressed }) => [styles.day, pressed && styles.pressed]}
            >
              <Text style={[styles.number, chosen && styles.chosen]}>
                {Number(day.slice(8))}
              </Text>
              <Text style={[styles.weekday, chosen && styles.chosenWeekday]}>{weekday}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, alignItems: 'center' },
  label: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.ivoryFaint,
    textAlign: 'center',
  },
  row: { gap: spacing.md, alignItems: 'center', paddingHorizontal: spacing.sm },
  day: { minWidth: 30, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  number: { fontFamily: fonts.serif, fontSize: 17, color: colors.ivoryFaint },
  chosen: { color: colors.brass },
  weekday: { fontFamily: fonts.sans, fontSize: 9, color: colors.frame },
  chosenWeekday: { color: colors.brassDim },
});
