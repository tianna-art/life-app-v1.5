import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import type { Clarification } from '@/types';

interface ClarificationChipProps {
  clarification: Clarification | null;
  onAnswer: (answer: string | null) => void;
}

/**
 * The one optional question (§14).
 *
 * It appears only when the answer would change which progression a record
 * belongs to and the model cannot infer it — never as a way to collect more
 * data, and never more than one at a time.
 *
 * Skipping is a first-class answer and sits beside the options rather than
 * hidden behind a dismiss affordance: §14 says the reply is optional, so
 * declining has to be as easy as answering.
 */
export function ClarificationChip({ clarification, onAnswer }: ClarificationChipProps) {
  if (!clarification) return null;

  return (
    <View style={styles.wrap} testID="clarification">
      <Text style={styles.question}>{clarification.question}</Text>
      <View style={styles.options}>
        {clarification.options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onAnswer(option)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={option}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipLabel}>{option}</Text>
          </Pressable>
        ))}
        <Pressable
          testID="clarification-skip"
          onPress={() => onAnswer(null)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LABELS.skip}
          style={({ pressed }) => [styles.chip, styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipLabel}>{LABELS.skip}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl, gap: spacing.sm },
  question: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ivoryFaint,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  skip: { borderColor: 'transparent' },
  pressed: { opacity: 0.6 },
  chipLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivory },
  skipLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
});
