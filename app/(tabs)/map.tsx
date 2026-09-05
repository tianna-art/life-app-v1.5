import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts, spacing } from '@/theme';
import { CHANGE } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { MonthStrip } from '@components/map/MonthStrip';
import { RadialChangeMap } from '@components/map/RadialChangeMap';
import { ChangeCard } from '@components/map/ChangeCard';
import { useChangeVerdict, useMonthChanges } from '@/hooks/useChanges';
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
 * MAP (§18–§24).
 *
 * One screen and one object. The sky at the top is the index; the cards below
 * are what each point means, in the order §27 fixes — the person's own records
 * first, then what those show, then what that has to do with what they put
 * down at the start.
 *
 * They are not two readings that have to be kept in step. Every point above is
 * a card below, drawn from the same row, so a point with nothing explaining it
 * cannot exist and a card with no point above it cannot either.
 *
 * A month with nothing to show draws ME alone and says so plainly (§31). That
 * is the common state early on and it is not apologised for.
 */
export default function MapScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const monthKey = useUiStore((s) => s.mapMonthKey);
  const setMonthKey = useUiStore((s) => s.setMapMonthKey);

  const [canvasBox, setCanvasBox] = useState<{ width: number; height: number } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  // Where each card sits, so a tap on its point can go there. Measured rather
  // than estimated: the cards are different heights and always will be.
  const cardTops = useRef<Record<string, number>>({});

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setCanvasBox((current) =>
      current && Math.abs(current.width - w) < 1 && Math.abs(current.height - h) < 1
        ? current
        : { width: w, height: h }
    );
  }, []);

  const { data: changes } = useMonthChanges(monthKey);
  const { data: review } = useMonthReview(monthKey, { enabled: isMonthEndReached(monthKey) });
  const verdict = useChangeVerdict(monthKey);

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
      setFocusedId(null);
      cardTops.current = {};
      scrollRef.current?.scrollTo({ y: 0, animated: false });
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

  /**
   * §24. A point is a question, and the card is where it is answered.
   *
   * Tapping moves the page rather than opening a sheet over the sky, so the
   * point stays visible beside its explanation and the person can look from
   * one to the other.
   */
  const handleSelect = useCallback((changeId: string) => {
    setFocusedId(changeId);
    const top = cardTops.current[changeId];
    if (top === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, top - 12), animated: true });
  }, []);

  const canvasWidth = Math.max(260, canvasBox?.width ?? width - spacing.gallery * 2);
  const canvasHeight = Math.max(300, Math.min(420, height * 0.44));

  const list = changes ?? [];

  return (
    <Screen>
      <TopBar>
        <View style={styles.strip}>
          <MonthStrip months={months} value={monthKey} onChange={setMonthKey} />
        </View>
        <View style={styles.plateRow}>
          <Text style={styles.plate}>{formatMonthEyebrow(monthKey)}</Text>
          {review?.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
        </View>
      </TopBar>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <GestureDetector gesture={pan}>
          <View
            style={[styles.canvas, { height: canvasHeight }]}
            testID="map-canvas"
            onLayout={onCanvasLayout}
          >
            <RadialChangeMap
              monthKey={monthKey}
              changes={list}
              selectedId={focusedId}
              width={canvasWidth}
              height={canvasHeight}
              onSelect={handleSelect}
            />
          </View>
        </GestureDetector>

        <HairlineRule />

        <Text style={styles.heading}>{CHANGE.heading}</Text>

        {list.length === 0 ? (
          // §31: nothing yet, said without apology and without a consoling
          // sentence after it.
          <Text testID="no-changes" style={styles.none}>
            {CHANGE.none}
          </Text>
        ) : (
          list.map((change) => (
            <View
              key={change.id}
              onLayout={(event) => {
                cardTops.current[change.id] = event.nativeEvent.layout.y;
              }}
            >
              <ChangeCard
                change={change}
                focused={focusedId === change.id}
                onOpenLog={(logId) => router.push(`/log/${logId}`)}
                onOpenAllEvidence={(logIds) => router.push(`/records/${logIds.join(',')}`)}
                onVerdict={(value) =>
                  verdict.mutate({ changeId: change.id, verdict: value })
                }
              />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { alignSelf: 'stretch' },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.md,
  },
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  reviewTitle: {
    fontFamily: fonts.serif,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.ivoryFaint,
  },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  canvas: { alignItems: 'center', justifyContent: 'center' },
  // The section §25 names. Set as a heading rather than an eyebrow: it is
  // Japanese, and the tracking that suits small caps turns kana into texture.
  heading: {
    fontFamily: fonts.serif,
    fontSize: 15,
    letterSpacing: 2,
    lineHeight: 24,
    color: colors.ivoryDim,
    textAlign: 'center',
  },
  none: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.ivoryFaint,
    paddingVertical: spacing.xl,
  },
});
