import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, fonts, radii, spacing } from '@/theme';

/** Short save confirmation. No counters, no scores, no praise. */
export function Toast({
  message,
  onDone,
  duration = 1800,
}: {
  message: string | null;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [message, onDone, duration]);

  if (!message) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      style={styles.toast}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassFaint,
    backgroundColor: colors.surface,
  },
  text: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 0.8, color: colors.ivory },
});
