import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { PeriodStrip } from '@components/list/PeriodStrip';
import { RecordRow } from '@components/list/RecordRow';
import { useFirstRecordedPeriod, usePeriodTitles, useSavePeriodTitle } from '@/hooks/usePeriodTitles';
import { useMonthLogs, useYearLogs } from '@/hooks/useLogs';
import { footprintState, monthStrip, periodLabel, yearStrip } from '@/utils/footprint';
import { monthKeyOf } from '@/utils/period';
import type { PeriodType } from '@/types';

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

  const { data: titles } = usePeriodTitles(scope);
  const { data: firstUsed } = useFirstRecordedPeriod();
  const saveTitle = useSavePeriodTitle();

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

  const switchScope = (next: PeriodType) => {
    setScope(next);
    setSelected(next === 'month' ? monthKeyOf(today) : String(today.getFullYear()));
    setDraft(null);
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
        }}
      />

      <HairlineRule />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {draft === null ? (
          <Pressable
            testID="title-open"
            onPress={() => setDraft(title?.title ?? '')}
            // A month still being lived has not finished being what it was.
            disabled={state === 'waiting' || state === 'future'}
            accessibilityRole="button"
            accessibilityLabel={title ? COPY.monthTitleEdit : COPY.handTitle}
            style={styles.titleBox}
          >
            <Text style={styles.titleEyebrow}>{`${periodLabel(selected)}の足跡タイトル`}</Text>
            <Text style={title ? styles.title : styles.titleEmpty}>
              {title?.title ?? placeholder(state)}
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

        <Text style={styles.recordsLabel}>{`${periodLabel(selected)}の${COPY.logsLabel}`}</Text>
        {logs.length === 0 ? (
          <Text style={styles.none}>{COPY.pastNone}</Text>
        ) : (
          logs.map((log) => <RecordRow key={log.id} log={log} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function placeholder(state: ReturnType<typeof footprintState>): string {
  if (state === 'waiting') return COPY.titlePending;
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
});
