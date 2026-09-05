import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { LOG_TYPES, MOMENT_TAGS } from '@/constants/log';
import type { LogType, MomentTag } from '@/types';

export interface ListFilter {
  /** null means every door. */
  logType: LogType | null;
  /** null means every kind of moment. */
  momentTag: MomentTag | null;
}

interface CategoryFilterProps {
  value: ListFilter;
  onChange: (value: ListFilter) => void;
}

/**
 * What to look through, on LIST.
 *
 * Two rows, because a record carries two things the person chose: the door
 * they left it through and what kind of moment it was. Both are worth
 * searching by and neither is worth searching by alone — "つぶやき" and
 * "モヤモヤ" find different things.
 *
 * Narrowing the archive, not scoring it: every option is drawn the same and
 * none of them shows a count. A number beside each would turn a way of
 * finding something into a tally of how the person spends themselves, which
 * §29 rules out. Tapping the chosen one again puts it back.
 *
 * Both rows keep the order the composer uses. Someone learns that order by
 * writing, and a different one here would cost them a beat every time they
 * came to look something up.
 */
export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const row = <T extends string>(
    all: string,
    testPrefix: string,
    options: readonly { id: T; label: string }[],
    current: T | null,
    pick: (next: T | null) => void
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID={`${testPrefix}-filter`}
    >
      <Pressable
        testID={`${testPrefix}-all`}
        onPress={() => pick(null)}
        hitSlop={HIT_SLOP}
        accessibilityRole="radio"
        accessibilityState={{ selected: current === null }}
        accessibilityLabel={all}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Text style={[styles.label, current === null && styles.selected]}>{all}</Text>
      </Pressable>

      {options.map((option) => {
        const on = current === option.id;
        return (
          <Pressable
            key={option.id}
            testID={`${testPrefix}-${option.id}`}
            onPress={() => pick(on ? null : option.id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={[styles.label, on && styles.selected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.rows}>
      {row(LABELS.allCategories, 'filter', LOG_TYPES, value.logType, (logType) =>
        onChange({ ...value, logType })
      )}
      {row(LABELS.allMoments, 'moment-filter', MOMENT_TAGS, value.momentTag, (momentTag) =>
        onChange({ ...value, momentTag })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.xs },
  row: { gap: spacing.lg, paddingRight: spacing.gallery, alignItems: 'center' },
  chip: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  selected: { color: colors.brass },
  pressed: { opacity: 0.6 },
});
