import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';

export type MapState = 'none' | 'stale' | 'ready' | 'empty';

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
   * Read the month again without re-reading its records.
   *
   * A month with everything read used to offer only its map. But reading the
   * records and reading the month are two different jobs — the second can fail
   * on its own, and its rules change — and there was no way to ask for it
   * again short of forgetting the records and paying for all of them twice.
   */
  onReread: () => void;
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
  onReread,
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

  // Read, but nothing came of it. Sending someone to an empty sky is worse
  // than offering the one thing that might change it, so the re-read leads.
  if (state === 'empty') {
    return (
      <Pressable
        testID="month-reread"
        onPress={onReread}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={LABELS.readAgain}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.label}>{LABELS.readAgain}</Text>
      </Pressable>
    );
  }

  if (state === 'ready') {
    return (
      <View style={styles.readyRow}>
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

        {/* Quieter than the map, and always there. One call, not twenty. */}
        <Pressable
          testID="month-reread"
          onPress={onReread}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LABELS.rereadMonth}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.quiet}>{LABELS.rereadMonth}</Text>
        </Pressable>
      </View>
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
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.6 },
  arrow: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim },
  quiet: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 0.8, color: colors.ivoryFaint },
  label: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 0.8, color: colors.brass },
  count: { fontFamily: fonts.sans, fontSize: 11, color: colors.ivoryFaint },
  progress: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim },
  failed: { minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'flex-end', gap: 2 },
  failure: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.danger },
});
