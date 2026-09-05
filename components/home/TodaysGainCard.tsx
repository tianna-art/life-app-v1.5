import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import type { TodaysGain } from '@/types';

interface TodaysGainCardProps {
  gain: TodaysGain | null;
  onDismiss: () => void;
  /** Opens the gain on the map, when there is one to open. */
  onOpen?: ((gainId: string) => void) | undefined;
  /** Milliseconds the card stays before it fades on its own. */
  duration?: number;
}

/**
 * The immediate reward (§8).
 *
 * At most one line, always short, and it disappears by itself. It is a
 * description of what was noticed — never praise, never a score, never an
 * invitation to reflect further. When nothing could be read, the line says so
 * plainly and that is the end of it.
 */
export function TodaysGainCard({
  gain,
  onDismiss,
  onOpen,
  duration = 9000,
}: TodaysGainCardProps) {
  useEffect(() => {
    if (!gain) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [gain, onDismiss, duration]);

  if (!gain) return null;

  const body = (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{LABELS.todaysGain}</Text>
      <Text style={styles.line}>{gain.line}</Text>
    </View>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      testID="todays-gain"
      accessibilityLiveRegion="polite"
    >
      {gain.gainId && onOpen ? (
        <Pressable
          onPress={() => onOpen(gain.gainId as string)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${LABELS.todaysGain} ${gain.line}`}
          accessibilityHint="マップでこの Gain を開きます"
          style={({ pressed }) => (pressed ? styles.pressed : undefined)}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.frameSoft,
  },
  pressed: { opacity: 0.6 },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.8,
    color: colors.brassDim,
  },
  line: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 27,
    color: colors.ivory,
  },
});
