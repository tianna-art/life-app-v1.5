import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { LOG_TYPES } from '@/constants/log';
import { CategoryIcon } from '@components/log/CategoryIcon';
import type { LogType } from '@/types';

interface CategoryFilterProps {
  /** null means every door. */
  value: LogType | null;
  onChange: (value: LogType | null) => void;
}

/**
 * Which door to look through, on LIST.
 *
 * Narrowing the archive, not scoring it: every option is drawn the same and
 * none of them shows a count. A number beside each door would turn a way of
 * finding something into a tally of how the person spends themselves, which
 * §29 rules out.
 *
 * The doors keep the order they have in the composer. Someone learns that
 * order by writing, and a different one here would cost them a beat every
 * time they came to look something up.
 */
export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="category-filter"
    >
      <Pressable
        testID="filter-all"
        onPress={() => onChange(null)}
        hitSlop={HIT_SLOP}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === null }}
        accessibilityLabel={LABELS.allCategories}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Text style={[styles.label, value === null && styles.selected]}>
          {LABELS.allCategories}
        </Text>
      </Pressable>

      {LOG_TYPES.map((type) => {
        const on = value === type.id;
        return (
          <Pressable
            key={type.id}
            testID={`filter-${type.id}`}
            onPress={() => onChange(on ? null : type.id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={type.label}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <View style={styles.withIcon}>
              <CategoryIcon
                logType={type.id}
                size={13}
                color={on ? colors.brass : colors.frame}
              />
              <Text style={[styles.label, on && styles.selected]}>{type.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.lg, paddingRight: spacing.gallery, alignItems: 'center' },
  chip: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  withIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  selected: { color: colors.brass },
  pressed: { opacity: 0.6 },
});
