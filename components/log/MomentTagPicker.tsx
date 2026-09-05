import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { MOMENT_TAGS } from '@/constants/log';
import type { MomentTag } from '@/types';

interface MomentTagPickerProps {
  value: readonly MomentTag[];
  onChange: (value: MomentTag[]) => void;
}

/**
 * どんな瞬間だった？ (§10).
 *
 * Seven, and more than one may be true at once — "first time" and "enjoyed"
 * and "friction" can all describe the same afternoon, and §15 depends on that:
 * the combination is what makes a record readable later.
 *
 * All seven are drawn the same. None of them is better than another, and the
 * two that would be easiest to weight — 楽しかった and モヤモヤ — are exactly
 * the two §10 warns against treating as progress or as growth.
 */
export function MomentTagPicker({ value, onChange }: MomentTagPickerProps) {
  const toggle = (tag: MomentTag) => {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  };

  return (
    <View style={styles.wrap} testID="moment-tag-picker">
      {MOMENT_TAGS.map((tag) => {
        const selected = value.includes(tag.id);
        return (
          <Pressable
            key={tag.id}
            testID={`moment-${tag.id}`}
            onPress={() => toggle(tag.id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={tag.label}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{tag.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
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
