import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { RecordRow } from '@components/list/RecordRow';
import { useLogsById } from '@/hooks/useLogs';

/**
 * The records behind a 見立てカード.
 *
 * Every card carries its evidence, and this is where that promise is kept: a
 * reading you cannot trace back is just an assertion about someone.
 */
export default function RecordsScreen() {
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const logIds = useMemo(() => (ids ?? '').split(',').filter(Boolean), [ids]);
  const { data: logs } = useLogsById(logIds);

  return (
    <Screen>
      <Pressable
        testID="records-back"
        onPress={() => router.back()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={COPY.back}
        style={styles.back}
      >
        <Text style={styles.backLabel}>{COPY.back}</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          {COPY.weekEvidence}
        </Text>
        {(logs ?? []).length === 0 ? (
          <Text style={styles.none}>{COPY.noLogsYet}</Text>
        ) : (
          (logs ?? []).map((log) => <RecordRow key={log.id} log={log} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: spacing.sm },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownDim },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  heading: { fontFamily: fonts.serif, fontSize: 18, color: colors.brown },
  none: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
});
