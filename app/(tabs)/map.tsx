import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { EmptyState } from '@components/ui/EmptyState';
import { MonthStrip } from '@components/map/MonthStrip';
import { RadialProgressionMap } from '@components/map/RadialProgressionMap';
import { ProgressionSheet } from '@components/map/ProgressionSheet';
import {
  useMonthProgressions,
  useProgressionDetail,
  useProgressionVerdict,
} from '@/hooks/useProgressions';
import { useYearLogs } from '@/hooks/useLogs';
import { useMonthReview } from '@/hooks/useMonthReview';
import { useUiStore } from '@/state/uiStore';
import {
  formatMonthEyebrow,
  isMonthEndReached,
  monthKeyOf,
  monthKeyOfDate,
  monthKeysBetween,
  shiftMonthKey,
} from '@/utils/period';

/**
 * MAP (§16–§20).
 *
 * One month is on screen at a time and months are never merged (§24). What is
 * drawn is not the records but the movement between them, so a month with a
 * lot of writing and nothing connected yet shows a quiet sky — which is
 * honest, and is what the first weeks look like.
 */
export default function MapScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const monthKey = useUiStore((s) => s.mapMonthKey);
  const setMonthKey = useUiStore((s) => s.setMapMonthKey);

  const [canvasBox, setCanvasBox] = useState<{ width: number; height: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setCanvasBox((current) =>
      current && Math.abs(current.width - w) < 1 && Math.abs(current.height - h) < 1
        ? current
        : { width: w, height: h }
    );
  }, []);

  const { data: monthProgressions } = useMonthProgressions(monthKey);
  const { data: review } = useMonthReview(monthKey, { enabled: isMonthEndReached(monthKey) });
  // The sheet needs the whole trail — a progression is its records, and §4
  // asks that every one of them stay reachable — so the detail query is not
  // scoped to the month even though the canvas is.
  const detail = useProgressionDetail(expandedId);
  const verdict = useProgressionVerdict();

  // The strip spans from the first month that holds anything to this one, so
  // it never offers a month the person has no records in.
  const thisMonth = useMemo(() => monthKeyOf(new Date()), []);
  const { data: yearEntries } = useYearLogs(monthKey.slice(0, 4));
  const months = useMemo(() => {
    const keys = new Set<string>([thisMonth, monthKey]);
    for (const entry of yearEntries ?? []) keys.add(monthKeyOfDate(entry.occurredOn));
    const sorted = [...keys].sort();
    const first = sorted[0] ?? thisMonth;
    const last = sorted[sorted.length - 1] ?? thisMonth;
    return monthKeysBetween(first, last > thisMonth ? last : thisMonth);
  }, [yearEntries, monthKey, thisMonth]);

  const step = useCallback(
    (delta: number) => {
      const next = shiftMonthKey(monthKey, delta);
      if (delta > 0 && next > thisMonth) return;
      setMonthKey(next);
      setExpandedId(null);
      setOpenId(null);
    },
    [monthKey, thisMonth, setMonthKey]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((event) => {
          'worklet';
          if (event.translationX > 48) runOnJS(step)(-1);
          else if (event.translationX < -48) runOnJS(step)(1);
        }),
    [step]
  );

  // One tap does both things: the trail extends on the canvas behind, and the
  // sheet opens over it. Closing the sheet leaves the trail showing.
  const handleSelect = useCallback((id: string) => {
    setExpandedId(id);
    setOpenId(id);
  }, []);

  const canvasWidth = Math.max(260, canvasBox?.width ?? width - spacing.gallery * 2);
  const canvasHeight = Math.max(320, canvasBox?.height ?? height - 260);

  const progressions = monthProgressions ?? [];

  return (
    <Screen>
      <TopBar>
        {/* The strip has to keep the full width to scroll in, so it opts out
            of the bar's centring rather than shrinking to its contents. */}
        <View style={styles.strip}>
          <MonthStrip months={months} value={monthKey} onChange={setMonthKey} />
        </View>
        <View style={styles.plateRow}>
          <Text style={styles.plate}>{formatMonthEyebrow(monthKey)}</Text>
          {review?.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
        </View>
      </TopBar>

      <GestureDetector gesture={pan}>
        <View style={styles.canvas} testID="map-canvas" onLayout={onCanvasLayout}>
          {progressions.length === 0 ? (
            <EmptyState message={EMPTY_STATE.map} />
          ) : (
            <RadialProgressionMap
              monthKey={monthKey}
              progressions={progressions}
              expandedId={expandedId}
              width={canvasWidth}
              height={canvasHeight}
              onSelect={handleSelect}
              onSelectStep={(logId) => router.push(`/log/${logId}`)}
            />
          )}
        </View>
      </GestureDetector>

      <ProgressionSheet
        detail={openId ? detail.data : null}
        onClose={() => setOpenId(null)}
        onOpenLog={(logId) => {
          setOpenId(null);
          router.push(`/log/${logId}`);
        }}
        onVerdict={(input) => {
          if (!openId) return;
          verdict.mutate({ progressionId: openId, ...input });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { alignSelf: 'stretch' },
  plateRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.md },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  reviewTitle: {
    fontFamily: fonts.serif,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.ivoryFaint,
  },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
