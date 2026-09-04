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
import { OrbitGraph } from '@components/map/OrbitGraph';
import { CategoryArticle } from '@components/map/CategoryArticle';
import { useCategories, useCategoryLookup } from '@/hooks/useCategories';
import { useMonthLogs, useYearLogs } from '@/hooks/useLogs';
import { useCategoryInsight, useKeywordReview } from '@/hooks/useInsight';
import { useUiStore } from '@/state/uiStore';
import { formatMonthEyebrow, monthKeyOf, shiftMonthKey, shiftYearKey, yearKeyOf } from '@/utils/period';
import type { KeywordCandidate, LogWithAnalysis } from '@/types';

/** In the year view a category can hold hundreds of records; show the fullest. */
const YEAR_LEAVES_PER_CATEGORY = 12;

/**
 * 自分 を中心にした放射図. Exactly one period is ever on screen: swiping moves
 * between whole months (or whole years) and never merges two of them.
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

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const { data: categories } = useCategories(true);
  const categoryLookup = useCategoryLookup();
  const monthQuery = useMonthLogs(monthKey);
  const yearQuery = useYearLogs(yearKeyValue);

  const periodKey = mode === 'month' ? monthKey : yearKeyValue;
  const allLogs = useMemo(
    () => (mode === 'month' ? (monthQuery.data ?? []) : (yearQuery.data ?? [])),
    [mode, monthQuery.data, yearQuery.data]
  );

  // The year view thins each branch so the figure stays readable on a phone.
  const graphLogs = useMemo<LogWithAnalysis[]>(() => {
    if (mode === 'month') return allLogs;
    const perCategory = new Map<string, LogWithAnalysis[]>();
    for (const log of allLogs) {
      const list = perCategory.get(log.categoryId) ?? [];
      list.push(log);
      perCategory.set(log.categoryId, list);
    }
    return [...perCategory.values()].flatMap((list) =>
      [...list]
        .sort((a, b) => b.body.length - a.body.length || a.id.localeCompare(b.id))
        .slice(0, YEAR_LEAVES_PER_CATEGORY)
    );
  }, [mode, allLogs]);

  const canGoForward =
    mode === 'month' ? monthKey < monthKeyOf(new Date()) : yearKeyValue < yearKeyOf(new Date());

  const step = useCallback(
    (delta: number) => {
      if (delta > 0 && !canGoForward) return;
      if (mode === 'month') setMonthKey(shiftMonthKey(monthKey, delta));
      else setYearKey(shiftYearKey(yearKeyValue, delta));
      setExpanded(new Set());
      setOpenCategoryId(null);
    },
    [mode, monthKey, yearKeyValue, canGoForward, setMonthKey, setYearKey]
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

  // A tap opens the branch and the article together: the records fan out
  // behind the reading view, so closing it lands you on what was just opened.
  const handleCategoryPress = useCallback((categoryId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      next.add(categoryId);
      return next;
    });
    setOpenCategoryId(categoryId);
  }, []);

  const selectedCategory = openCategoryId ? categoryLookup.get(openCategoryId) : undefined;
  const categoryLogs = useMemo(
    () => allLogs.filter((l) => l.categoryId === openCategoryId),
    [allLogs, openCategoryId]
  );

  const insightQuery = useCategoryInsight({
    periodType: mode,
    periodKey,
    categoryId: openCategoryId ?? '',
    categoryName: selectedCategory?.name ?? '',
    logs: categoryLogs,
    enabled: Boolean(openCategoryId),
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

  const label = mode === 'month' ? formatMonthEyebrow(monthKey) : yearKeyValue;
  const canvasWidth = width - spacing.gallery * 2;
  const canvasHeight = Math.max(340, height - 232);

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
                  setExpanded(new Set());
                  setOpenCategoryId(null);
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
          {graphLogs.length === 0 ? (
            <EmptyState message={mode === 'month' ? EMPTY_STATE.map : EMPTY_STATE.mapYear} />
          ) : (
            <OrbitGraph
              periodKey={periodKey}
              width={canvasWidth}
              height={canvasHeight}
              categories={categories ?? []}
              logs={graphLogs}
              expanded={expanded}
              onCategoryPress={handleCategoryPress}
              onLogPress={(id) => router.push(`/log/${id}`)}
            />
          )}
        </View>
      </GestureDetector>

      <Text style={styles.hint}>
        引き出しをタップすると、まとめが記事として開きます。横スワイプで前後の
        {mode === 'month' ? '月' : '年'}へ。
      </Text>

      <CategoryArticle
        visible={Boolean(openCategoryId)}
        categoryName={selectedCategory?.name ?? ''}
        periodLabel={label}
        insight={insightQuery.data ?? null}
        loading={insightQuery.isLoading}
        logs={categoryLogs}
        onClose={() => setOpenCategoryId(null)}
        onLogPress={(id) => {
          setOpenCategoryId(null);
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
  header: { paddingTop: spacing.md, gap: spacing.sm },
  toggle: { flexDirection: 'row', gap: spacing.lg },
  toggleItem: { minHeight: MIN_TOUCH - 10, justifyContent: 'center', gap: 4 },
  toggleLabel: { fontFamily: fonts.serif, fontSize: 16, color: colors.ivoryFaint },
  toggleLabelActive: { color: colors.ivory },
  toggleRule: { height: 1, backgroundColor: 'transparent' },
  toggleRuleActive: { backgroundColor: colors.brass },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrowHit: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { fontSize: 22, color: colors.brassDim, fontFamily: fonts.serif },
  arrowDisabled: { color: colors.frame },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 18,
    color: colors.ivoryFaint,
    textAlign: 'center',
    paddingBottom: spacing.sm,
  },
});
