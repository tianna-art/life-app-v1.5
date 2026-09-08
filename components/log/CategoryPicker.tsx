import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { ANTENNAS, antennaShortLabel } from '@/constants/log';
import type { AntennaId, CategoryId } from '@/types';

interface CategoryPickerProps {
  /** The month's antennas, in the order they were picked. At most two. */
  antennaIds: readonly AntennaId[];
  value: CategoryId | null;
  onChange: (value: CategoryId) => void;
}

/**
 * Which of the month's categories this record is.
 *
 * Only the antennas the person chose this month are offered. That is the whole
 * point of choosing: the fifteen exist, but a month is three or six of them,
 * and putting all fifteen on the screen would turn a reflex into a search.
 *
 * The antenna's own name sits above its three as a quiet plate, because
 * 「できた」 and 「調子がよかった」 mean different things depending on which
 * question they are answering. It is a heading, not an option — nothing is
 * chosen at that level.
 */
export function CategoryPicker({ antennaIds, value, onChange }: CategoryPickerProps) {
  return (
    <View style={styles.groups} testID="category-picker">
      {antennaIds.map((antennaId) => (
        <View key={antennaId} style={styles.group}>
          {/* Named only when there is more than one: with a single antenna the
              plate says what the screen already only offers. */}
          {antennaIds.length > 1 ? (
            <Text style={styles.antenna}>{antennaShortLabel(antennaId)}</Text>
          ) : null}
          <View style={styles.row}>
            {ANTENNAS[antennaId].categories.map((category) => {
              const selected = value === category.id;
              return (
                <Pressable
                  key={category.id}
                  testID={`category-${category.id}`}
                  onPress={() => onChange(category.id)}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={category.label}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.label, selected && styles.labelSelected]}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.md, alignSelf: 'stretch' },
  group: { gap: spacing.sm, alignItems: 'center' },
  antenna: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 2.6,
    color: colors.brassDim,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  chipSelected: { borderColor: colors.brass },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 1, color: colors.ivoryFaint },
  labelSelected: { color: colors.brass },
});
