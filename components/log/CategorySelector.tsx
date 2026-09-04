import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import type { Category } from '@/types';

interface CategorySelectorProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
}

/**
 * Required, but never framed as a set to complete: these are drawers, and only
 * active ones are offered.
 */
export function CategorySelector({ categories, value, onChange }: CategorySelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="category-selector"
    >
      {categories.map((category) => {
        const selected = value === category.id;
        return (
          <Pressable
            key={category.id}
            testID={`category-${category.slug}`}
            onPress={() => onChange(category.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={category.name}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{category.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  chipSelected: { borderColor: colors.brass, backgroundColor: colors.brassFaint },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 14, color: colors.ivoryDim },
  labelSelected: { color: colors.ivory },
});
