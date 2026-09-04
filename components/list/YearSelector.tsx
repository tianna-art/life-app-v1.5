import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';

interface YearSelectorProps {
  year: number;
  years: number[];
  onChange: (year: number) => void;
}

/** `‹ 2026 ›` — at least the last five years are reachable. */
export function YearSelector({ year, years, onChange }: YearSelectorProps) {
  const oldest = Math.min(...years);
  const newest = Math.max(...years);

  return (
    <View style={styles.row} testID="year-selector">
      <Pressable
        testID="year-prev"
        onPress={() => onChange(year - 1)}
        disabled={year <= oldest}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${year - 1}年へ`}
        style={styles.arrowHit}
      >
        <Text style={[styles.arrow, year <= oldest && styles.arrowDisabled]}>‹</Text>
      </Pressable>
      <Text style={styles.year} accessibilityRole="header">
        {year}
      </Text>
      <Pressable
        testID="year-next"
        onPress={() => onChange(year + 1)}
        disabled={year >= newest}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${year + 1}年へ`}
        style={styles.arrowHit}
      >
        <Text style={[styles.arrow, year >= newest && styles.arrowDisabled]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  arrowHit: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 24, color: colors.brassDim, fontFamily: fonts.serif },
  arrowDisabled: { color: colors.frame },
  year: { fontFamily: fonts.serif, fontSize: 30, letterSpacing: 2, color: colors.ivory },
});
