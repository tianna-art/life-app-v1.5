import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { Eyebrow } from '@components/ui/Eyebrow';
import { EmptyState } from '@components/ui/EmptyState';
import { ConstellationMap } from '@components/map/ConstellationMap';
import { CategoryInsightSheet } from '@components/map/CategoryInsightSheet';
import { useCategories, useCategoryLookup } from '@/hooks/useCategories';
import { useMonthLogs, useYearLogs } from '@/hooks/useLogs';
import { useCategoryInsight, useKeywordReview } from '@/hooks/useInsight';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow, shiftMonthKey, shiftYearKey, monthKeyOf, yearKeyOf } from '@/utils/period';
import type { KeywordCandidate } from '@/types';

/**
 * The sky. Exactly one period is ever on screen: swiping moves between whole
 * months (or whole years) and never merges two of them.
 */
export default function MapScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const mode = useUiStore((s) => s.mapMode);
  const monthKey = useUiStore((s) => s.mapMonthKey);
  const yearKeyValue = useUiStore((s) => s.mapYearKey);
  const setMode = useUiStore((s) => s.setMapMode);
  const setMonthKey = useUiStore((s) => s.setMapMonthKey);
  const setYearKey = useUiStore((s) => s.setMapYearKey);
  const openedLogIds = useUiStore((s) => s.openedLogIds);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: categories } = useCategories(true);
  const categoryLookup = useCategoryLookup();
  const monthQuery = useMonthLogs(monthKey);
  const yearQuery = useYearLogs(yearKeyValue);

  const periodKey = mode === 'month' ? monthKey : yearKeyValue;
  const logs = useMemo(
    () => (mode === 'month' ? (monthQuery.data ?? []) : (yearQuery.data ?? [])),
    [mode, monthQuery.data, yearQuery.data]
  );

  const canGoForward =
    mode === 'month' ? monthKey < monthKeyOf(new Date()) : yearKeyValue < yearKeyOf(new Date());

  const step = useCallback(
    (delta: number) => {
      if (delta > 0 && !canGoForward) return;
      if (mode === 'month') setMonthKey(shiftMonthKey(monthKey, delta));
      else setYearKey(shiftYearKey(yearKeyValue, delta));
      setSelectedCategoryId(null);
    },
    [mode, monthKey, yearKeyValue, canGoForward, setMonthKey, setYearKey]
  );

  // Horizontal swipe: right = older, left = newer. One period per gesture.
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

  const selectedCategory = selectedCategoryId ? categoryLookup.get(selectedCategoryId) : undefined;
  const categoryLogs = useMemo(
    () => logs.filter((l) => l.categoryId === selectedCategoryId),
    [logs, selectedCategoryId]
  );

  const insightQuery = useCategoryInsight({
    periodType: mode,
    periodKey,
    categoryId: selectedCategoryId ?? '',
    categoryName: selectedCategory?.name ?? '',
    logs: categoryLogs,
    enabled: Boolean(selectedCategoryId),
  });
  const review = useKeywordReview();

  const applyReview = (
    status: 'accepted' | 'edited' | 'skipped',
    finalKeywords: KeywordCandidate[]
  ) => {
    const insight = insightQuery.data;
    if (!insight) return;
    review.mutate({ insight, status, finalKeywords });
  };

  const mapHeight = Math.max(320, height * 0.52);
  const label = mode === 'month' ? formatMonthEyebrow(monthKey) : yearKeyValue;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.toggle} accessibilityRole="tablist">
          {(['month', 'year'] as const).map((value) => {
            const selected = mode === value;
            return (
              <Pressable
                key={value}
                testID={`map-mode-${value}`}
                onPress={() => {
                  setMode(value);
                  setSelectedCategoryId(null);
                }}
                hitSlop={HIT_SLOP}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={value === 'month' ? LABELS.monthly : LABELS.yearly}
                style={styles.toggleItem}
              >
                <Text style={[styles.toggleLabel, selected && styles.toggleLabelActive]}>
                  {value === 'month' ? LABELS.monthly : LABELS.yearly}
                </Text>
                <View style={[styles.toggleRule, selected && styles.toggleRuleActive]} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.periodRow}>
          <Pressable
            testID="map-prev"
            onPress={() => step(-1)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="前の期間へ"
            style={styles.arrowHit}
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Eyebrow>{label}</Eyebrow>
          <Pressable
            testID="map-next"
            onPress={() => step(1)}
            disabled={!canGoForward}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="次の期間へ"
            accessibilityState={{ disabled: !canGoForward }}
            style={styles.arrowHit}
          >
            <Text style={[styles.arrow, !canGoForward && styles.arrowDisabled]}>›</Text>
          </Pressable>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.canvas} testID="map-canvas">
          {logs.length === 0 ? (
            <EmptyState message={mode === 'month' ? EMPTY_STATE.map : EMPTY_STATE.mapYear} />
          ) : (
            <ConstellationMap
              mode={mode}
              periodKey={periodKey}
              width={width - spacing.gallery * 2}
              height={mapHeight}
              categories={categories ?? []}
              logs={logs}
              openedLogIds={new Set(openedLogIds)}
              onCategoryPress={setSelectedCategoryId}
              onLogPress={(id) => router.push(`/log/${id}`)}
            />
          )}
        </View>
      </GestureDetector>

      <Text style={styles.hint}>横にスワイプすると、前後の{mode === 'month' ? '月' : '年'}へ移ります。</Text>

      <CategoryInsightSheet
        visible={Boolean(selectedCategoryId)}
        categoryName={selectedCategory?.name ?? ''}
        periodLabel={label}
        insight={insightQuery.data ?? null}
        loading={insightQuery.isLoading}
        logs={categoryLogs}
        onClose={() => setSelectedCategoryId(null)}
        onLogPress={(id) => {
          setSelectedCategoryId(null);
          router.push(`/log/${id}`);
        }}
        onKeywordAccept={(keywords) => applyReview('accepted', keywords)}
        onKeywordEdit={(keywords) => applyReview('edited', keywords)}
        onKeywordSkip={() => applyReview('skipped', [])}
        reviewBusy={review.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.lg, gap: spacing.md },
  toggle: { flexDirection: 'row', gap: spacing.lg },
  toggleItem: { minHeight: MIN_TOUCH - 8, justifyContent: 'center', gap: 4 },
  toggleLabel: { fontFamily: fonts.serif, fontSize: 17, color: colors.ivoryFaint },
  toggleLabelActive: { color: colors.ivory },
  toggleRule: { height: 1, backgroundColor: 'transparent' },
  toggleRuleActive: { backgroundColor: colors.brass },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrowHit: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 22, color: colors.brassDim, fontFamily: fonts.serif },
  arrowDisabled: { color: colors.frame },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ivoryFaint,
    textAlign: 'center',
    paddingBottom: spacing.md,
  },
});
