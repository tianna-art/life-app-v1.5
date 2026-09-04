import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line } from 'react-native-svg';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { Eyebrow } from '@components/ui/Eyebrow';
import { EmptyState } from '@components/ui/EmptyState';
import { Toast } from '@components/ui/Toast';
import { HairlineRule } from '@components/ui/HairlineRule';
import { LogComposer } from '@components/log/LogComposer';
import { MonthlyTitleCard } from '@components/titles/MonthlyTitleCard';
import { TruncatedLogRow } from '@components/list/TruncatedLogRow';
import { useCategories } from '@/hooks/useCategories';
import { useCreateLog, useMonthLogs } from '@/hooks/useLogs';
import { useMonthlyIntention, useSaveIntention } from '@/hooks/useIntention';
import { formatMonthEyebrow, monthKeyOf } from '@/utils/period';

/** Home. The place to leave a point, and nothing more demanding than that. */
export default function LogScreen() {
  const router = useRouter();
  const currentMonth = useMemo(() => monthKeyOf(new Date()), []);
  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: categories } = useCategories();
  const { data: logs } = useMonthLogs(currentMonth);
  const { data: intention } = useMonthlyIntention(currentMonth);
  const saveIntention = useSaveIntention();
  const createLog = useCreateLog();

  const [intentionDraft, setIntentionDraft] = useState<string | null>(null);

  const recent = (logs ?? []).slice(0, 5);

  const handleSave = useCallback(
    (input: Parameters<typeof createLog.mutate>[0]) => {
      createLog.mutate(input, {
        onSuccess: (result) => {
          setComposerOpen(false);
          setToast(result.queued ? '保存しました（接続が戻ったら同期します）' : LABELS.saved);
        },
      });
    },
    [createLog]
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Eyebrow>{formatMonthEyebrow(currentMonth)}</Eyebrow>
          <Pressable
            testID="open-settings"
            onPress={() => router.push('/settings/categories')}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="カテゴリー設定"
          >
            <Text style={styles.settings}>設定</Text>
          </Pressable>
        </View>

        <MonthlyTitleCard monthKey={currentMonth} logCount={logs?.length ?? 0} />

        {/* Optional. Never required, never scored. */}
        {intentionDraft === null ? (
          <Pressable
            testID="intention-open"
            onPress={() => setIntentionDraft(intention?.body ?? '')}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={intention?.body ? `今月の宣言 ${intention.body}` : LABELS.intentionPrompt}
          >
            <Text style={intention?.body ? styles.intention : styles.intentionCta}>
              {intention?.body ?? LABELS.intentionPrompt}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.intentionEditor}>
            <TextInput
              testID="intention-input"
              value={intentionDraft}
              onChangeText={setIntentionDraft}
              placeholder="焦らず作る"
              placeholderTextColor={colors.ivoryFaint}
              style={styles.intentionInput}
              accessibilityLabel="今月の宣言"
              maxLength={40}
            />
            <Pressable
              testID="intention-save"
              onPress={() => {
                const body = (intentionDraft ?? '').trim();
                if (body.length > 0) {
                  saveIntention.mutate({ periodKey: currentMonth, body });
                }
                setIntentionDraft(null);
              }}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="宣言を保存"
            >
              <Text style={styles.intentionSave}>✓</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.plusZone}>
          <Pressable
            testID="open-composer"
            onPress={() => setComposerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="記録を追加"
            accessibilityHint="出来事かつぶやきを残します"
            style={({ pressed }) => [styles.plusHit, pressed && styles.plusPressed]}
          >
            <Svg width={132} height={132} viewBox="-66 -66 132 132">
              <Circle r={62} fill="none" stroke={colors.frame} strokeWidth={0.6} />
              <Circle r={52} fill="none" stroke={colors.brassDim} strokeWidth={0.8} />
              <Circle r={52} fill={colors.brass} opacity={0.04} />
              <Line x1={-17} y1={0} x2={17} y2={0} stroke={colors.brass} strokeWidth={1.2} />
              <Line x1={0} y1={-17} x2={0} y2={17} stroke={colors.brass} strokeWidth={1.2} />
            </Svg>
          </Pressable>
        </View>

        <HairlineRule />

        {recent.length === 0 ? (
          <EmptyState message={EMPTY_STATE.log} />
        ) : (
          <View style={styles.recent}>
            <Text style={styles.recentLabel}>この月の記録</Text>
            {recent.map((log) => (
              <TruncatedLogRow key={log.id} log={log} onPress={(id) => router.push(`/log/${id}`)} />
            ))}
          </View>
        )}
      </ScrollView>

      <LogComposer
        visible={composerOpen}
        categories={categories ?? []}
        onClose={() => setComposerOpen(false)}
        onSave={handleSave}
        saving={createLog.isPending}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  settings: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.ivoryFaint,
    minHeight: 20,
  },
  intention: { fontFamily: fonts.serif, fontSize: 14, color: colors.ivoryDim },
  intentionCta: { fontFamily: fonts.sans, fontSize: 12, color: colors.ivoryFaint },
  intentionEditor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  intentionInput: {
    flex: 1,
    minHeight: MIN_TOUCH - 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frameSoft,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  intentionSave: { color: colors.brass, fontSize: 20, paddingHorizontal: spacing.sm },
  plusZone: { alignItems: 'center', paddingVertical: spacing.xl },
  plusHit: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusPressed: { opacity: 0.6 },
  recent: { paddingTop: spacing.md },
  recentLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
    marginBottom: spacing.xs,
  },
});
