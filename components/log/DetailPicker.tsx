import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { getCategoryById } from '@/constants/log';
import type { CategoryId, DetailId } from '@/types';

interface DetailPickerProps {
  categoryId: CategoryId;
  value: DetailId | null;
  onChange: (value: DetailId | null) => void;
}

/**
 * What about it.
 *
 * One option, not several. The category already said what kind of day it was;
 * this says which part of it, and picking two would mean the record is about
 * two things — which is two records.
 *
 * The question above the chips belongs to the category and changes with it:
 * 「どんな『できた』だった？」 under できた, 「何が関係していそう？」 under
 * 調子がよかった. The same question everywhere would make the second tap feel
 * like filing rather than remembering.
 *
 * Tapping the chosen one again clears it. A detail is optional: the category
 * and the free text are a complete record without it.
 */
export function DetailPicker({ categoryId, value, onChange }: DetailPickerProps) {
  const category = getCategoryById(categoryId);

  return (
    <View style={styles.wrap} testID="detail-picker">
      <Text style={styles.question}>{category.detailQuestion}</Text>
      <View style={styles.row}>
        {category.details.map((detail) => {
          const selected = value === detail.id;
          return (
            <Pressable
              key={detail.id}
              testID={`detail-${detail.id}`}
              onPress={() => onChange(selected ? null : detail.id)}
              hitSlop={HIT_SLOP}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={detail.label}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{detail.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, alignItems: 'center', alignSelf: 'stretch' },
  question: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.ivoryFaint,
    textAlign: 'center',
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
  chipSelected: { borderColor: colors.brass, backgroundColor: colors.brassFaint },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  labelSelected: { color: colors.brass },
});
