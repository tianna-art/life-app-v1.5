import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { GAIN_TYPE_JA, GAIN_TYPE_LABEL, JOURNEY_ROLE_JA } from '@/constants/gain';
import { inputCategoryLabel } from '@/constants/inputCategories';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useEntry } from '@/hooks/useEntries';
import { formatShortDate } from '@/utils/period';

/**
 * One record, in full (§20).
 *
 * The body as the person wrote it, then what stayed from it. No keywords, no
 * scores, no prompt to reflect further — the reading already happened.
 */
export default function EntryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data: entry } = useEntry(id);

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={LABELS.back}
        style={styles.back}
      >
        <Text style={styles.backLabel}>‹ {LABELS.back}</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {entry ? (
          <>
            <View style={styles.metaRow}>
              <Text style={styles.date}>{formatShortDate(entry.occurredOn)}</Text>
              <Text style={styles.meta}>{inputCategoryLabel(entry.inputCategory)}</Text>
              {entry.analysis ? (
                <Text style={styles.meta}>{JOURNEY_ROLE_JA[entry.analysis.journeyRole]}</Text>
              ) : null}
            </View>

            <HairlineRule />

            <Text style={styles.body}>{entry.body}</Text>

            {entry.gains && entry.gains.length > 0 ? (
              <>
                <HairlineRule />
                <Text style={styles.sectionLabel}>この記録から残ったもの</Text>
                <View style={styles.gains}>
                  {entry.gains.map((gain) => (
                    <View key={gain.id} style={styles.gainRow}>
                      <Text style={styles.gainType}>
                        {GAIN_TYPE_LABEL[gain.type]}
                        <Text style={styles.gainTypeJa}>{`　${GAIN_TYPE_JA[gain.type]}`}</Text>
                      </Text>
                      <Text style={styles.gainLabel}>{gain.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.meta}>この記録は見つかりませんでした。</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  date: { fontFamily: fonts.serif, fontSize: 20, color: colors.brass },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.ivoryFaint },
  body: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 29, color: colors.ivory },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
  },
  gains: { gap: spacing.md },
  gainRow: { gap: 2 },
  gainType: { fontFamily: fonts.sans, fontSize: 9.5, letterSpacing: 2.2, color: colors.brassDim },
  gainTypeJa: { fontFamily: fonts.sans, fontSize: 9.5, letterSpacing: 0.6, color: colors.frame },
  gainLabel: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, color: colors.ivory },
});
