import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { INPUT_CATEGORIES } from '@/constants/inputCategories';
import type { InputCategory } from '@/types';

interface CategoryChipsProps {
  value: InputCategory | null;
  onChange: (value: InputCategory) => void;
}

/**
 * 進んだ / ひっかかった / 心が動いた (§6).
 *
 * This is the only classification the person ever does, and it is one tap.
 * There is no "other", no editing, and no settings behind it — a drawer the
 * person can rename is a drawer they have to think about.
 */
export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  return (
    <View style={styles.row} testID="category-chips" accessibilityRole="radiogroup">
      {INPUT_CATEGORIES.map((category) => {
        const selected = value === category.id;
        return (
          <Pressable
            key={category.id}
            testID={`chip-${category.id}`}
            onPress={() => onChange(category.id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={category.label}
            accessibilityHint={category.covers.join('、')}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{category.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: MIN_TOUCH - 8,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  chipSelected: { borderColor: colors.brass, backgroundColor: colors.brassFaint },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 14, color: colors.ivoryDim },
  labelSelected: { color: colors.ivory },
});
