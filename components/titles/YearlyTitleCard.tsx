import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { TitleEditor } from './TitleEditor';
import { useMonthlyTitles, usePeriodTitle, useSaveTitle, useTitleCandidates } from '@/hooks/useTitles';
import { isYearlyTitleAiUnlocked } from '@/utils/titleUnlock';

export function YearlyTitleCard({ yearKey, logCount }: { yearKey: string; logCount: number }) {
  const [open, setOpen] = useState(false);
  const { data: title } = usePeriodTitle('year', yearKey);
  const { data: monthlyTitles } = useMonthlyTitles(yearKey);
  const save = useSaveTitle();
  const candidates = useTitleCandidates();

  const aiAvailable = isYearlyTitleAiUnlocked({
    periodKey: yearKey,
    logCount,
    monthlyTitles: monthlyTitles ?? [],
  });

  return (
    <View style={styles.wrap}>
      {title?.title ? (
        <Pressable
          testID={`yearly-title-${yearKey}`}
          onPress={() => setOpen(true)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`年次タイトル ${title.title}`}
        >
          <Text style={styles.title}>{title.title}</Text>
        </Pressable>
      ) : (
        <Pressable
          testID={`yearly-title-cta-${yearKey}`}
          onPress={() => setOpen(true)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LABELS.titleThisYear}
        >
          <Text style={styles.cta}>{LABELS.titleThisYear}</Text>
        </Pressable>
      )}

      <TitleEditor
        visible={open}
        heading={yearKey}
        initialTitle={title?.title ?? ''}
        candidates={candidates.data ?? []}
        loadingCandidates={candidates.isPending}
        aiAvailable={aiAvailable}
        onRequestCandidates={() =>
          candidates.mutate({ periodType: 'year', periodKey: yearKey, periodLabel: yearKey })
        }
        onConfirm={(value, source) => {
          save.mutate({
            periodType: 'year',
            periodKey: yearKey,
            title: value,
            source,
            isConfirmed: true,
          });
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 29, color: colors.ivory },
  cta: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1, color: colors.brassDim },
});
