import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { antenna } from '@/constants/antennas';
import type { AntennaId } from '@/types';

/**
 * The butter band: what this month is watching, shown while writing into it.
 *
 * It is not a control. The words are the ones the person chose, shown exactly
 * as chosen — no AI rewording, here or anywhere — and the way to change them
 * is on the map, which the line underneath says.
 */
export function MonthDirectionBand({
  month,
  antennaIds,
}: {
  /** 1–12. */
  month: number;
  antennaIds: readonly AntennaId[];
}) {
  return (
    <View style={styles.band} testID="month-direction-band">
      <Text style={styles.eyebrow}>{`${month}月の方向`}</Text>
      {antennaIds.length === 0 ? (
        <Text style={styles.none}>{COPY.placeMonth}</Text>
      ) : (
        <View style={styles.chips}>
          {antennaIds.map((id) => {
            const a = antenna(id);
            if (!a) return null;
            return (
              <View key={id} style={[styles.chip, { backgroundColor: a.color }]}>
                <Text style={styles.chipLabel}>{a.title}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.butter,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.brownDim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  chipLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.brown },
  none: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownDim },
});
