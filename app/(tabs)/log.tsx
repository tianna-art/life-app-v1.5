import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { Toast } from '@components/ui/Toast';
import { RouteTabs, type LogRoute } from '@components/log/RouteTabs';
import { MonthDirectionBand } from '@components/log/MonthDirectionBand';
import { Composer } from '@components/log/Composer';
import { FutureMemoRoute } from '@components/future/FutureMemoRoute';
import { FlowQuest } from '@components/flow/FlowQuest';
import { VisionIntro } from '@components/vision/VisionIntro';
import { useMonthDirection } from '@/hooks/useDirection';
import { useCreateLog } from '@/hooks/useLogs';
import { useLastFlowSession, useSaveFlowSession } from '@/hooks/useFlow';
import { monthKeyOf } from '@/utils/period';

/**
 * 入力 — ひとこと記録 / 未来メモ / 感情クエスト.
 *
 * 感情クエスト is built in Phase 5 and says so rather than pretending to be
 * something else.
 */
export default function LogScreen() {
  const today = useMemo(() => new Date(), []);
  const periodKey = useMemo(() => monthKeyOf(today), [today]);
  const [route, setRoute] = useState<LogRoute>('category');
  const [toast, setToast] = useState<string | null>(null);

  const { data: direction } = useMonthDirection(periodKey);
  const createLog = useCreateLog();
  const { data: lastFlow } = useLastFlowSession();
  const saveFlow = useSaveFlowSession();
  const antennaIds = direction?.antennaIds ?? [];

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <RouteTabs value={route} onChange={setRoute} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Above the 方向 band and below the tabs, on every route: the
              invitation belongs to the screen, not to one way of writing. It
              shows itself only while the board is empty. */}
          <VisionIntro />

          {route === 'category' ? (
            <>
              <MonthDirectionBand month={today.getMonth() + 1} antennaIds={antennaIds} />
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>{COPY.dateLabel}</Text>
                <Text style={styles.date}>{`${today.getMonth() + 1}/${today.getDate()}`}</Text>
              </View>

              <Composer
                periodKey={periodKey}
                occurredOn={isoDate(today)}
                antennaIds={antennaIds}
                saving={createLog.isPending}
                onSave={(input) =>
                  createLog.mutate(input, {
                    onSuccess: (result) =>
                      // A queued record is saved as far as the person is
                      // concerned; the connection is our problem, not theirs.
                      setToast(COPY.visionSaved),
                  })
                }
              />

              <Text style={styles.why}>{COPY.logWhy}</Text>
              <Text style={styles.changeAt}>{COPY.changeAtMap}</Text>
            </>
          ) : null}

          {route === 'future' ? <FutureMemoRoute /> : null}

          {route === 'flow' ? (
            <FlowQuest
              last={lastFlow ?? null}
              onSave={(entries) => {
                saveFlow.mutate(entries);
                setToast(COPY.visionSaved);
              }}
              onDiscard={() => undefined}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast message={toast} onDone={() => setToast(null)} />
    </Screen>
  );
}

/** `YYYY-MM-DD` in the device's own day, not UTC. */
function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.brownFaint },
  date: { fontFamily: fonts.sans, fontSize: 15, color: colors.brown },
  why: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownFaint },
  changeAt: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.brownFaint,
    textAlign: 'right',
  },
  pending: { paddingVertical: spacing.xl },
  pendingText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.brownDim },
});
