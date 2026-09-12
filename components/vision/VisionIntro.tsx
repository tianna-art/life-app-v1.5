import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { useVision } from '@/hooks/useVision';

/**
 * はじめに — the invitation to put a ビジョンボード together.
 *
 * It shows itself. The component asks whether the board is empty and opens the
 * editor on its own, rather than taking `visible` and `onStart` from whichever
 * screen renders it. That is deliberate: in the prototype the handler lived
 * inside the 現在地 renderer alone, which is exactly why the same card on the
 * input screen had a 「はじめる」 that did nothing. A card that carries its own
 * condition and its own way in cannot be half-wired by the next screen to
 * render it.
 *
 * Three rules it keeps:
 *
 * There is no 「あとで」. The screen underneath works perfectly without a
 * board, so an explicit way to decline would only add a decision.
 *
 * It is not a gate. Everything below it stays usable — a record can be written
 * and saved with this card still on screen.
 *
 * It disappears for good the moment the board holds anything at all, and it
 * does not come back.
 */
export function VisionIntro() {
  const router = useRouter();
  const { data: vision } = useVision();

  // Nothing until the answer is in: flashing an invitation at somebody who
  // already has a board is worse than showing it a moment late.
  if (!vision) return null;
  if (vision.items.length > 0 || vision.words.length > 0) return null;

  return (
    <View style={styles.card} testID="vision-intro">
      <Text style={styles.eyebrow}>{`✦ ${COPY.visionEyebrow}`}</Text>
      <Text style={styles.title}>{COPY.visionTitle}</Text>
      <Text style={styles.body}>{COPY.visionBody}</Text>
      <Pressable
        testID="vision-start"
        onPress={() => router.push('/vision/setup')}
        accessibilityRole="button"
        accessibilityLabel={COPY.visionGo}
        style={({ pressed }) => [styles.start, pressed && styles.pressed]}
      >
        <Text style={styles.startLabel}>{COPY.visionGo}</Text>
      </Pressable>
      <Text style={styles.later}>{COPY.visionLaterNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Paper and a thin orange line. Not the butter of a 方向 band — this is an
  // invitation, and the yellow belongs to the thing being aimed at.
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.orangeLine,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.orange },
  title: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, color: colors.brown, textAlign: 'center' },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 23,
    color: colors.brownDim,
    textAlign: 'center',
  },
  start: {
    minHeight: MIN_TOUCH,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
  },
  startLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.onBrown },
  pressed: { opacity: 0.62 },
  later: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint, textAlign: 'center' },
});
