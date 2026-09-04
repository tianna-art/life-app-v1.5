import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useLog } from '@/hooks/useLogs';
import { useCategoryLookup } from '@/hooks/useCategories';
import { useUiStore } from '@/state/uiStore';
import { formatShortDate } from '@/utils/period';

/** One record, in full. Type / category / body / AI keywords, nothing scored. */
export default function LogDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data: log } = useLog(id);
  const categories = useCategoryLookup();
  const markOpened = useUiStore((s) => s.markLogOpened);

  useEffect(() => {
    if (id) markOpened(id);
  }, [id, markOpened]);

  // Soft-deleted categories still resolve, so historic logs keep their name.
  const category = log ? categories.get(log.categoryId) : undefined;

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="戻る"
        style={styles.back}
      >
        <Text style={styles.backLabel}>‹ 戻る</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {log ? (
          <>
            <View style={styles.metaRow}>
              <Text style={styles.date}>{formatShortDate(log.occurredOn)}</Text>
              <Text style={styles.meta}>{log.type === 'event' ? LABELS.event : LABELS.thought}</Text>
              {category ? (
                <Text style={styles.meta}>
                  {category.name}
                  {category.isActive ? '' : '（非表示のカテゴリー）'}
                </Text>
              ) : null}
            </View>

            <HairlineRule />

            <Text style={styles.body}>{log.body}</Text>

            {log.analysis && log.analysis.keywords.length > 0 ? (
              <>
                <HairlineRule />
                <Text style={styles.sectionLabel}>KEYWORDS</Text>
                <View style={styles.chips}>
                  {log.analysis.keywords.map((keyword) => (
                    <Text key={keyword} style={styles.chip}>{`#${keyword}`}</Text>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  date: { fontFamily: fonts.serif, fontSize: 20, color: colors.brass },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.ivoryFaint },
  body: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 29, color: colors.ivory },
  sectionLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2.6, color: colors.ivoryFaint },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { fontFamily: fonts.sans, fontSize: 13, color: colors.brass },
});
