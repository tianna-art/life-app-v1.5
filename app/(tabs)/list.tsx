import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY, LOCAL_COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { PeriodStrip } from '@components/list/PeriodStrip';
import { PeriodChange } from '@components/scope/PeriodChange';
import { ScopeTabs, namingTabs, type ScopeTab } from '@components/scope/ScopeTabs';
import { RecordRow } from '@components/list/RecordRow';
import { useFirstRecordedPeriod, usePeriodTitles, useSavePeriodTitle } from '@/hooks/usePeriodTitles';
import { useSaveOwnSummary, useSummary } from '@/hooks/useReading';
import { useMonthLogs, useYearLogs } from '@/hooks/useLogs';
import {
  daysUntilNameable,
  footprintState,
  monthStrip,
  periodLabel,
  yearStrip,
} from '@/utils/footprint';
import { monthKeyOf } from '@/utils/period';
import { summaryText, type PeriodType } from '@/types';

/**
 * 足跡データ — the months and years already lived, each under the name it was
 * given, with the records that were left in them.
 *
 * Periods that ended before the app was ever opened can still be named, by
 * hand. A life did not start when the software did.
 */
export default function ListScreen() {
  const today = useMemo(() => new Date(), []);
  const [scope, setScope] = useState<PeriodType>('month');
  const [selected, setSelected] = useState(() => monthKeyOf(today));
  const [draft, setDraft] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<string | null>(null);
  // While a name is being decided the screen stops stacking and starts
  // switching, which is how the preview behaves: naming is a comparing job,
  // so the material is put side by side rather than end to end.
  const [reviewTab, setReviewTab] = useState<ScopeTab>('summary');

  const { data: titles } = usePeriodTitles(scope);
  const { data: firstUsed } = useFirstRecordedPeriod();
  const saveTitle = useSavePeriodTitle();
  const { data: summary } = useSummary(scope, selected);
  const saveOwnSummary = useSaveOwnSummary();

  const keys = useMemo(
    () => (scope === 'month' ? monthStrip(today) : yearStrip(today)),
    [scope, today]
  );

  const monthLogs = useMonthLogs(scope === 'month' ? selected : '');
  const yearLogs = useYearLogs(scope === 'year' ? Number(selected) : 0);
  const logs = (scope === 'month' ? monthLogs.data : yearLogs.data) ?? [];

  const title = (titles ?? []).find((t) => t.periodKey === selected);
  // A year is compared against the year the person started, not the month.
  const firstUsedKey = scope === 'month' ? (firstUsed ?? undefined) : firstUsed?.slice(0, 4);
  const state = footprintState({
    periodKey: selected,
    today,
    hasTitle: Boolean(title),
    firstUsedKey,
  });

  const naming = draft !== null;
  /** Everything is on screen at once, unless a name is being decided. */
  const showing = (tab: ScopeTab) => !naming || reviewTab === tab;

  const switchScope = (next: PeriodType) => {
    setScope(next);
    setSelected(next === 'month' ? monthKeyOf(today) : String(today.getFullYear()));
    setDraft(null);
    setSummaryDraft(null);
    setReviewTab('summary');
  };

  return (
    <Screen>
      <View style={styles.scopes}>
        {(['month', 'year'] as PeriodType[]).map((id) => (
          <Pressable
            key={id}
            testID={`scope-${id}`}
            onPress={() => switchScope(id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === id }}
            style={({ pressed }) => [
              styles.scope,
              scope === id && styles.scopeOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.scopeLabel, scope === id && styles.scopeLabelOn]}>
              {id === 'month' ? '月次' : '年次'}
            </Text>
          </Pressable>
        ))}
      </View>

      <PeriodStrip
        periodKeys={keys}
        titles={titles ?? []}
        selected={selected}
        today={today}
        firstUsedKey={firstUsedKey}
        onSelect={(key) => {
          setSelected(key);
          setDraft(null);
          setSummaryDraft(null);
          setReviewTab('summary');
        }}
      />

      <HairlineRule />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {draft === null ? (
          <Pressable
            testID="title-open"
            onPress={() => {
              setDraft(title?.title ?? '');
              setReviewTab('summary');
            }}
            // A month still being lived has not finished being what it was.
            disabled={state === 'waiting' || state === 'future'}
            accessibilityRole="button"
            accessibilityLabel={title ? COPY.monthTitleEdit : COPY.handTitle}
            style={styles.titleBox}
          >
            <Text style={styles.titleEyebrow}>{`${periodLabel(selected)}の足跡タイトル`}</Text>
            <Text style={title ? styles.title : styles.titleEmpty}>
              {title?.title ?? placeholder(state, daysUntilNameable(selected, today))}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.editor}>
            <TextInput
              testID="title-input"
              value={draft}
              onChangeText={setDraft}
              placeholder={scope === 'month' ? COPY.handTitlePlaceholder : COPY.handTitleYear}
              placeholderTextColor={colors.brownFaint}
              style={styles.input}
              accessibilityLabel="足跡タイトル"
              autoFocus
            />
            <Pressable
              testID="title-save"
              onPress={() => {
                const text = draft.trim();
                if (text.length > 0) {
                  saveTitle.mutate({ periodType: scope, periodKey: selected, title: text });
                }
                setDraft(null);
              }}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="足跡タイトルを保存"
              style={styles.round}
            >
              <Text style={styles.check}>✓</Text>
            </Pressable>
          </View>
        )}

        {/* 4つ目（先月からの変化 / 去年との違い）は、名前を決めている時だけ。
            The row itself only appears while naming, because the rest of the
            time there is nothing to switch between: 要約 and 出来事 simply
            follow one another down the screen. */}
        {naming ? (
          <ScopeTabs tabs={namingTabs(scope)} value={reviewTab} onChange={setReviewTab} />
        ) : null}

        {showing('change') ? <PeriodChange periodType={scope} /> : null}

        {/* 要約. The reading writes one; the person may write over it, in a
            field of their own — so regenerating the reading later does not
            quietly discard what they wrote. */}
        {!showing('summary') ? null : summaryDraft === null ? (
          <Pressable
            testID="summary-open"
            onPress={() => setSummaryDraft(summary?.bodyUser ?? summary?.body ?? '')}
            accessibilityRole="button"
            accessibilityLabel={COPY.digestLabel}
            style={styles.summaryBox}
          >
            <View style={styles.summaryHead}>
              <Text style={styles.titleEyebrow}>{COPY.digestLabel}</Text>
              {summary?.bodyUser ? (
                <Text style={styles.ownMark}>{LOCAL_COPY.summaryIsYours}</Text>
              ) : null}
            </View>
            {summary && summaryText(summary).length > 0 ? (
              <>
                {summary.keywords.length > 0 ? (
                  <Text style={styles.keywords}>{summary.keywords.join(' / ')}</Text>
                ) : null}
                <Text style={styles.summaryBody}>{summaryText(summary)}</Text>
              </>
            ) : (
              <Text style={styles.titleEmpty}>
                {scope === 'month' ? COPY.digestPending : COPY.yearDigestPending}
              </Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.summaryEditor} testID="summary-editor">
            <Text style={styles.titleEyebrow}>{COPY.digestLabel}</Text>
            <TextInput
              testID="summary-input"
              value={summaryDraft}
              onChangeText={setSummaryDraft}
              multiline
              style={styles.summaryInput}
              accessibilityLabel={COPY.digestLabel}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.summaryActions}>
              <Pressable
                testID="summary-cancel"
                onPress={() => setSummaryDraft(null)}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="やめる"
              >
                <Text style={styles.quiet}>やめる</Text>
              </Pressable>
              <Pressable
                testID="summary-save"
                onPress={() => {
                  saveOwnSummary.mutate({
                    periodType: scope,
                    periodKey: selected,
                    bodyUser: summaryDraft,
                  });
                  setSummaryDraft(null);
                }}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="要約を保存"
                style={styles.round}
              >
                <Text style={styles.check}>✓</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showing('records') ? (
          <>
            <Text style={styles.recordsLabel}>
              {`${periodLabel(selected)}の${COPY.logsLabel}`}
            </Text>
            {logs.length === 0 ? (
              <Text style={styles.none}>{COPY.pastNone}</Text>
            ) : (
              logs.map((log) => <RecordRow key={log.id} log={log} />)
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function placeholder(state: ReturnType<typeof footprintState>, daysLeft: number): string {
  if (state === 'waiting') return `${COPY.titlePending}（あと${daysLeft}日）`;
  if (state === 'hand' || state === 'ready') return COPY.handTitle;
  return COPY.monthTitleEmpty;
}

const styles = StyleSheet.create({
  scopes: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md, justifyContent: 'center' },
  scope: {
    minHeight: MIN_TOUCH - 12,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  scopeOn: { borderColor: colors.hairline, backgroundColor: colors.paper },
  scopeLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  scopeLabelOn: { color: colors.brown },
  pressed: { opacity: 0.6 },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  titleBox: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xs,
  },
  titleEyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  title: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, color: colors.brown },
  titleEmpty: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 21, color: colors.brownFaint },
  editor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  round: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 20, color: colors.onBrown, lineHeight: 24 },
  recordsLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.brownFaint,
    paddingTop: spacing.md,
  },
  none: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  summaryBox: {
    backgroundColor: colors.butter,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ownMark: { fontFamily: fonts.sans, fontSize: 10, color: colors.brownDim },
  keywords: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, color: colors.brownDim },
  summaryBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 24, color: colors.brown },
  summaryEditor: {
    backgroundColor: colors.butter,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryInput: {
    minHeight: 110,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 24,
  },
  summaryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quiet: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownDim },
});
