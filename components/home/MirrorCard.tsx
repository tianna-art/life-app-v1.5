import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { HairlineRule } from '@components/ui/HairlineRule';
import type { Mirror } from '@/types';

interface MirrorCardProps {
  mirror: Mirror | null;
  onDismiss: () => void;
  /** Opens the progression this entry joined, when it joined one. */
  onOpenProgression: (id: string) => void;
}

/**
 * The line shown right after a save (§15).
 *
 * One sentence, taken from the record itself. No advice, no lesson, no
 * trajectory — those need more than one dot, and inventing one here would make
 * the fastest, most-repeated moment in the app the least honest.
 *
 * When the entry landed on a trail that already existed, the line says so and
 * becomes tappable. That is the whole reward, and it is deliberately quiet.
 */
export function MirrorCard({ mirror, onDismiss, onOpenProgression }: MirrorCardProps) {
  if (!mirror || mirror.line.length === 0) return null;

  const joined = mirror.joinedProgression;

  const body = (
    <View style={styles.card} testID="mirror-card">
      <Text style={styles.eyebrow}>{LABELS.mirror}</Text>
      <HairlineRule />
      <Text style={styles.line}>{mirror.line}</Text>
    </View>
  );

  if (!joined) {
    return (
      <Pressable
        onPress={onDismiss}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={mirror.line}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="mirror-open-progression"
      onPress={() => onOpenProgression(joined.id)}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={mirror.line}
      accessibilityHint={`${joined.title}をひらく`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.xl, gap: spacing.sm },
  pressed: { opacity: 0.6 },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.ivoryFaint,
  },
  line: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 28,
    color: colors.ivory,
  },
});
