import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { LogRow } from '@components/list/LogRow';
import { getRepository } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { LogWithAnalysis } from '@/types';

/**
 * What a reading was read from (§4).
 *
 * Reached by opening a branch on the map. A branch is a hypothesis about
 * several records at once, so it is only checkable against all of them — one
 * record would be the app choosing which part of its own argument to show.
 *
 * The records are printed as they were written. Nothing here summarises them
 * again: the summary is the thing being checked.
 */
export default function ReferencedRecordsScreen() {
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids: string }>();

  const logIds = useMemo(
    () => (ids ?? '').split(',').map((id) => id.trim()).filter(Boolean),
    [ids]
  );

  const results = useQueries({
    queries: logIds.map((id) => ({
      queryKey: queryKeys.log(id),
      queryFn: () => getRepository().getLog(id),
    })),
  });

  const records = results
    .map((r) => r.data)
    .filter((log): log is LogWithAnalysis => Boolean(log))
    // Oldest first: they are being read as a sequence, which is what made
    // them one branch in the first place.
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const loading = results.some((r) => r.isPending);

  return (
    <Screen>
      <TopBar onBack={() => router.back()}>
        <Text style={styles.plate}>{LABELS.evidence}</Text>
      </TopBar>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.note}>{LABELS.evidenceNote}</Text>
        <HairlineRule />

        {loading && records.length === 0 ? (
          <Text style={styles.dim}>読み込んでいます。</Text>
        ) : records.length === 0 ? (
          <Text style={styles.dim}>もとになった記録が見つかりませんでした。</Text>
        ) : (
          records.map((entry) => (
            <View key={entry.id}>
              <LogRow entry={entry} onPress={(id) => router.push(`/log/${id}`)} />
              <HairlineRule />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryFaint },
  dim: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
});
