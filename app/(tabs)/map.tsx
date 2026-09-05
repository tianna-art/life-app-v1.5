import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { EmptyState } from '@components/ui/EmptyState';
import { MonthStrip } from '@components/map/MonthStrip';
import { RadialGainMap } from '@components/map/RadialGainMap';
import { GainSheet } from '@components/map/GainSheet';
import { useGainDetail, useGainVerdict, useMonthGains } from '@/hooks/useGains';
import { useYearEntries } from '@/hooks/useEntries';
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
 * MAP (§13–§18).
 *
 * One month is on screen at a time and months are never merged. What is drawn
 * is not the records but what has grown from them, so a month with a lot of
 * writing and nothing settled shows a quiet sky — which is honest.
 */
export default function MapScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const monthKey = useUiStore((s) => s.mapMonthKey);
  const setMonthKey = useUiStore((s) => s.setMapMonthKey);

  const [canvasBox, setCanvasBox] = useState<{ width: number; height: number } | null>(null);
  const [openGainId, setOpenGainId] = useState<string | null>(null);
  const [expandedGainId, setExpandedGainId] = useState<string | null>(null);

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setCanvasBox((current) =>
      current && Math.abs(current.width - w) < 1 && Math.abs(current.height - h) < 1
        ? current
        : { width: w, height: h }
    );
  }, []);

  const { data: monthGains } = useMonthGains(monthKey);
  const { data: review } = useMonthReview(monthKey, { enabled: isMonthEndReached(monthKey) });
  const gainDetail = useGainDetail(openGainId);
  const verdict = useGainVerdict();

  // The strip spans from the first month that holds anything to this one, so
  // it never offers a month the person has no records in.
  const thisMonth = useMemo(() => monthKeyOf(new Date()), []);
  const { data: yearEntries } = useYearEntries(monthKey.slice(0, 4));
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
      setExpandedGainId(null);
      setOpenGainId(null);
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

  const handleGainPress = useCallback((gainId: string) => {
    setExpandedGainId(gainId);
    setOpenGainId(gainId);
  }, []);

  const canvasWidth = Math.max(260, canvasBox?.width ?? width - spacing.gallery * 2);
  const canvasHeight = Math.max(320, canvasBox?.height ?? height - 260);

  const gains = monthGains ?? [];
  const hasNew = gains.some((g) => g.isNew);
  const hasContinuing = gains.some((g) => !g.isNew);

  return (
    <Screen>
      <View style={styles.header}>
        <MonthStrip months={months} value={monthKey} onChange={setMonthKey} />
        <View style={styles.plateRow}>
          <Text style={styles.plate}>{formatMonthEyebrow(monthKey)}</Text>
          {review?.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.canvas} testID="map-canvas" onLayout={onCanvasLayout}>
          {gains.length === 0 ? (
            <EmptyState message={EMPTY_STATE.map} />
          ) : (
            <RadialGainMap
              monthKey={monthKey}
              gains={gains}
              width={canvasWidth}
              height={canvasHeight}
              expandedGainId={expandedGainId}
              onGainPress={handleGainPress}
              onEvidencePress={(logId) => router.push(`/log/${logId}`)}
            />
          )}
        </View>
      </GestureDetector>

      {/* NEW / CONTINUING is a distinction, not a count (§18). */}
      <View style={styles.footer}>
        {hasNew ? <Text style={styles.footNew}>{LABELS.new}</Text> : null}
        {hasContinuing ? <Text style={styles.footContinuing}>{LABELS.continuing}</Text> : null}
      </View>

      <GainSheet
        visible={Boolean(openGainId)}
        detail={gainDetail.data ?? null}
        loading={gainDetail.isLoading}
        busy={verdict.isPending}
        onClose={() => setOpenGainId(null)}
        onVerdict={(input) => {
          if (!openGainId) return;
          verdict.mutate({ gainId: openGainId, ...input });
        }}
        onEvidencePress={(logId) => {
          setOpenGainId(null);
          router.push(`/log/${logId}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, gap: spacing.sm },
  plateRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  reviewTitle: { fontFamily: fonts.serif, fontSize: 13, letterSpacing: 1.4, color: colors.ivoryFaint },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  footNew: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2.4, color: colors.brassDim },
  footContinuing: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2.4, color: colors.frame },
});
