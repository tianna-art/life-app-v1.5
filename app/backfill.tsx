import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { BACKFILL } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { collectUnread, recentMonths, runBackfill } from '@/ai/backfill';
import type { BackfillResult } from '@/ai/backfill';
import { formatMonthEyebrow } from '@/utils/period';
import type { DailyLog } from '@/types';

const RANGES = [3, 4, 6, 12] as const;

/**
 * Reading records that were never read.
 *
 * Not on the daily surface and not offered on its own: it is reached from the
 * menu on LIST, because it exists for records that arrived some way other than
 * being written here.
 *
 * The count is shown before anything runs. Each record is a call to the model
 * and the person is paying for it, so the number they are agreeing to is on
 * screen before the button is, and stopping is available the whole way through.
 */
export default function BackfillScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<number>(4);
  const [pending, setPending] = useState<DailyLog[] | null>(null);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);

  // Read between records by the runner. A ref rather than state so a tap is
  // seen by a loop that is already going.
  const stopRef = useRef(false);

  const months = recentMonths(range);

  const look = useCallback(() => {
    setResult(null);
    setPending(null);
    void collectUnread(recentMonths(range)).then(setPending);
  }, [range]);

  useEffect(look, [look]);

  const start = async () => {
    if (!pending || pending.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setDone(0);
    try {
      const outcome = await runBackfill(pending, {
        onProgress: (p) => setDone(p.done),
        shouldStop: () => stopRef.current,
      });
      setResult(outcome);
    } finally {
      setRunning(false);
      // Everything on MAP and LIST is now stale.
      await queryClient.invalidateQueries();
      look();
    }
  };

  const first = months[0];
  const last = months[months.length - 1];

  return (
    <Screen>
      <TopBar onBack={() => router.back()}>
        <Text style={styles.plate}>{BACKFILL.heading}</Text>
      </TopBar>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.explain}>{BACKFILL.explain}</Text>
        <Text style={styles.note}>{BACKFILL.order}</Text>

        <HairlineRule />

        <Text style={styles.section}>{BACKFILL.rangeLabel}</Text>
        <View style={styles.ranges}>
          {RANGES.map((n) => (
            <Pressable
              key={n}
              testID={`range-${n}`}
              onPress={() => setRange(n)}
              disabled={running}
              hitSlop={HIT_SLOP}
              accessibilityRole="radio"
              accessibilityState={{ selected: range === n, disabled: running }}
              accessibilityLabel={`${n}ヶ月`}
              style={({ pressed }) => [styles.range, pressed && styles.pressed]}
            >
              <Text style={[styles.rangeLabel, range === n && styles.rangeSelected]}>
                {n}ヶ月
              </Text>
            </Pressable>
          ))}
        </View>

        {first && last ? (
          <Text style={styles.period}>
            {formatMonthEyebrow(first)} — {formatMonthEyebrow(last)}
          </Text>
        ) : null}

        <HairlineRule />

        {pending === null ? (
          <ActivityIndicator color={colors.brass} style={styles.loading} />
        ) : pending.length === 0 ? (
          <Text style={styles.explain}>{BACKFILL.none}</Text>
        ) : (
          <>
            <Text testID="pending-count" style={styles.count}>
              {pending.length}件
            </Text>

            {running ? (
              <>
                <Text testID="backfill-progress" style={styles.progress}>
                  {done} / {pending.length}
                </Text>
                <Text style={styles.note}>{BACKFILL.keepOpen}</Text>
                <Pressable
                  testID="backfill-stop"
                  onPress={() => {
                    stopRef.current = true;
                  }}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={BACKFILL.stop}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <Text style={styles.actionLabel}>{BACKFILL.stop}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                testID="backfill-start"
                onPress={() => void start()}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={BACKFILL.start}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionLabel}>{BACKFILL.start}</Text>
              </Pressable>
            )}
          </>
        )}

        {result ? (
          <View testID="backfill-result" style={styles.result}>
            <HairlineRule />
            <Text style={styles.explain}>{result.read}件を読みました。</Text>
            {/* A record that answered from the local path never reached the
                model, so it is named rather than folded into the total. */}
            {result.fellBack > 0 ? (
              <Text style={styles.note}>
                {result.fellBack}件は接続できず、端末側で読みました。もう一度実行すると読み直します。
              </Text>
            ) : null}
            {result.stopped ? <Text style={styles.note}>途中でとめました。</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  explain: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 24, color: colors.ivory },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryFaint },
  section: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2.6, color: colors.ivoryFaint },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  range: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  rangeLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.ivoryFaint },
  rangeSelected: { color: colors.brass },
  period: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.brassDim },
  loading: { paddingVertical: spacing.lg, alignSelf: 'flex-start' },
  count: { fontFamily: fonts.serif, fontSize: 32, color: colors.ivory },
  progress: { fontFamily: fonts.serif, fontSize: 24, color: colors.brass },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  actionLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 1.2, color: colors.brass },
  pressed: { opacity: 0.6 },
  result: { gap: spacing.sm },
});
