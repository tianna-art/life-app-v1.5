import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { SIGNALS } from '@/constants/entry';
import type { SubjectiveSignal } from '@/types';

interface SignalPickerProps {
  value: SubjectiveSignal | null;
  onChange: (value: SubjectiveSignal) => void;
}

/**
 * ＋ ± − (§3).
 *
 * The one thing only the person knows. Three marks and nothing else: §3 is
 * explicit that the meanings are not spelled out on screen, because a legend
 * ("positive / energizing / good for me") turns a reflex into an assessment.
 * The words live in the accessibility label, where they help and do not weigh.
 *
 * 成功 and 失敗 appear nowhere, here or anywhere else.
 */
export function SignalPicker({ value, onChange }: SignalPickerProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID="signal-picker">
      {SIGNALS.map((signal) => {
        const selected = value === signal.id;
        return (
          <Pressable
            key={signal.id}
            testID={`signal-${signal.id}`}
            onPress={() => onChange(signal.id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={signal.hint}
            style={({ pressed }) => [styles.mark, pressed && styles.pressed]}
          >
            <Text style={[styles.glyph, selected && styles.glyphSelected]}>{signal.mark}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  mark: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  glyph: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.frame,
  },
  glyphSelected: { color: colors.brass },
});
