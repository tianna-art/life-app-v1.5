import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';

export type MapState = 'none' | 'stale' | 'ready';

interface MonthActionProps {
  state: MapState;
  /**
   * How many records the run will read. More than the month's own when
   * earlier months are still unread — see LIST for why.
   */
  pending: number;
  running: boolean;
  /** Records read so far in this run. */
  done: number;
  onGenerate: () => void;
  onOpen: () => void;
  /**
   * Why the last run here read nothing. Shown instead of leaving the button
   * looking untouched — a control that changes nothing and says nothing is
   * indistinguishable from one that is broken.
   */
  failure?: string | undefined;
}

/**
 * What a month offers beside its name.
 *
 * A month with unread records offers to read them; a month that has been read
 * offers its map. Those are the only two things there are to do with a month
 * from here, so they share one place rather than hiding in a menu.
 *
 * The count is printed on the button. Every record it will read is a call to
 * the model that the person pays for, so the number they are agreeing to is
 * visible before they agree to it — and it is the honest number, including
 * the earlier records the run has to read first.
 */
export function MonthAction({
  state,
  pending,
  running,
  done,
  onGenerate,
  onOpen,
  failure,
}: MonthActionProps) {
  if (running) {
    return (
      <View style={styles.action} testID="month-action-running">
        <ActivityIndicator color={colors.brass} size="small" />
        <Text style={styles.progress}>
          {done} / {pending}
        </Text>
      </View>
    );
  }

  if (state === 'ready') {
    return (
      <Pressable
        testID="month-open-map"
        onPress={onOpen}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={LABELS.openMap}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.label}>{LABELS.openMap}</Text>
      </Pressable>
    );
  }

  if (failure) {
    return (
      <Pressable
        testID="month-generate-map"
        onPress={onGenerate}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${failure} ${LABELS.tryAgain}`}
        style={({ pressed }) => [styles.failed, pressed && styles.pressed]}
      >
        <Text style={styles.failure}>{failure}</Text>
        <Text style={styles.label}>{LABELS.tryAgain}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="month-generate-map"
      onPress={onGenerate}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${state === 'stale' ? LABELS.regenerateMap : LABELS.generateMap} ${pending}件`}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text style={styles.arrow}>→</Text>
      <Text style={styles.label}>
        {state === 'stale' ? LABELS.regenerateMap : LABELS.generateMap}
      </Text>
      <Text style={styles.count}>{pending}件</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingLeft: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  arrow: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim },
  label: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 0.8, color: colors.brass },
  count: { fontFamily: fonts.sans, fontSize: 11, color: colors.ivoryFaint },
  progress: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim },
  failed: { minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'flex-end', gap: 2 },
  failure: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.danger },
});
