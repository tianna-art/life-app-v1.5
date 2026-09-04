import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { Eyebrow } from '@components/ui/Eyebrow';
import { EmptyState } from '@components/ui/EmptyState';
import { Toast } from '@components/ui/Toast';
import { HairlineRule } from '@components/ui/HairlineRule';
import { InlineComposer } from '@components/log/InlineComposer';
import { LogMenu, LogMenuButton } from '@components/log/LogMenu';
import { MonthlyTitleCard } from '@components/titles/MonthlyTitleCard';
import { TruncatedLogRow } from '@components/list/TruncatedLogRow';
import { useCategories } from '@/hooks/useCategories';
import { useCreateLog, useMonthLogs } from '@/hooks/useLogs';
import { useMonthlyIntention, useSaveIntention } from '@/hooks/useIntention';
import { formatMonthEyebrow, monthKeyOf } from '@/utils/period';
import { signOutEverywhere } from '@/lib/session';
import { useLocalStore } from '@/lib/env';
import type { MenuItem } from '@components/log/LogMenu';

/** Home. Open it and the field is already there. */
export default function LogScreen() {
  const router = useRouter();
  const currentMonth = useMemo(() => monthKeyOf(new Date()), []);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { data: logs } = useMonthLogs(currentMonth);
  const { data: intention } = useMonthlyIntention(currentMonth);
  const saveIntention = useSaveIntention();
  const createLog = useCreateLog();

  const recent = (logs ?? []).slice(0, 8);

  // Signing out drops the cached rows with the session: the next person to
  // open the app must not find someone else's month already on screen.
  const handleSignOut = useCallback(() => {
    void signOutEverywhere().finally(() => queryClient.clear());
  }, [queryClient]);

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: 'カテゴリーの設定', onPress: () => router.push('/settings/categories') },
      { label: 'この月をマップで見る', onPress: () => router.push('/map') },
      { label: '一年を読み返す', onPress: () => router.push('/list') },
    ];
    // Local-store mode has no session, so it is not offered a way out of one.
    if (!useLocalStore) {
      items.push({
        label: 'ログアウト',
        onPress: handleSignOut,
        separated: true,
        confirmLabel: 'もう一度押すとログアウト',
      });
    }
    return items;
  }, [router, handleSignOut]);

  const handleSave = useCallback(
    (input: Parameters<typeof createLog.mutate>[0]) => {
      createLog.mutate(input, {
        onSuccess: (result) => {
          setToast(result.queued ? '保存しました（接続が戻ったら同期します）' : LABELS.saved);
        },
      });
    },
    [createLog]
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Eyebrow>{formatMonthEyebrow(currentMonth)}</Eyebrow>
            <LogMenuButton onPress={() => setMenuOpen(true)} />
          </View>

          <MonthlyTitleCard monthKey={currentMonth} logCount={logs?.length ?? 0} />

          {intentionDraft === null ? (
            <Pressable
              testID="intention-open"
              onPress={() => setIntentionDraft(intention?.body ?? '')}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={
                intention?.body ? `今月の宣言 ${intention.body}` : LABELS.intentionPrompt
              }
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
                  if (body.length > 0) saveIntention.mutate({ periodKey: currentMonth, body });
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

          <View style={styles.composer}>
            <InlineComposer
              categories={categories ?? []}
              onSave={handleSave}
              saving={createLog.isPending}
              onOpenCategorySettings={() => router.push('/settings/categories')}
            />
          </View>

          <HairlineRule />

          {recent.length === 0 ? (
            <EmptyState message={EMPTY_STATE.log} />
          ) : (
            <View style={styles.recent}>
              <Text style={styles.recentLabel}>この月の記録</Text>
              {recent.map((log) => (
                <TruncatedLogRow
                  key={log.id}
                  log={log}
                  onPress={(id) => router.push(`/log/${id}`)}
                  maxChars={26}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <LogMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <Toast message={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
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
  composer: { marginTop: spacing.md },
  recent: { paddingTop: spacing.md },
  recentLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
    marginBottom: spacing.xs,
  },
});
