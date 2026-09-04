import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { CategoryMark } from '@components/ui/CategoryMark';
import type { Category } from '@/types';

interface CategorySelectorProps {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  /** Opens category settings. The mark sits beside the drawers it edits. */
  onOpenSettings?: (() => void) | undefined;
}

/**
 * Required, but never framed as a set to complete: these are drawers, and only
 * active ones are offered. Each wears its own mark, the same one the MAP draws.
 *
 * The settings mark is pinned outside the scroll, so it stays reachable however
 * far along the row you have scrolled.
 */
export function CategorySelector({
  categories,
  value,
  onChange,
  onOpenSettings,
}: CategorySelectorProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        testID="category-selector"
        style={styles.scroll}
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
              <CategoryMark icon={category.icon} size={16} active={selected} />
              <Text style={[styles.label, selected && styles.labelSelected]}>{category.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {onOpenSettings ? (
        <Pressable
          testID="open-category-settings"
          onPress={onOpenSettings}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="カテゴリーの設定"
          style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
        >
          <Text style={styles.settingsMark}>⚙</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scroll: { flex: 1 },
  // The last chip needs somewhere to scroll clear of the settings mark, or the
  // row appears to be cut off by it rather than continuing behind it.
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  chipSelected: { borderColor: colors.brass, backgroundColor: colors.brassFaint },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 14, color: colors.ivoryDim },
  labelSelected: { color: colors.ivory },
  settings: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.frameSoft,
    paddingLeft: spacing.xs,
    minWidth: MIN_TOUCH - 8,
    minHeight: MIN_TOUCH - 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsMark: { fontSize: 16, color: colors.brassDim },
});
