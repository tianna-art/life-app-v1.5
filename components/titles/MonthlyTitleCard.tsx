import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { TitleEditor } from './TitleEditor';
import { usePeriodTitle, useSaveTitle, useTitleCandidates } from '@/hooks/useTitles';
import { isMonthlyTitleAiUnlocked } from '@/utils/titleUnlock';
import { formatMonthEyebrow } from '@/utils/period';

interface MonthlyTitleCardProps {
  monthKey: string;
  logCount: number;
  /** Renders nothing but the editor entry point when there is no title yet. */
  compact?: boolean;
}

export function MonthlyTitleCard({ monthKey, logCount, compact = false }: MonthlyTitleCardProps) {
  const [open, setOpen] = useState(false);
  const { data: title } = usePeriodTitle('month', monthKey);
  const save = useSaveTitle();
  const candidates = useTitleCandidates();

  const aiAvailable = isMonthlyTitleAiUnlocked({ periodKey: monthKey, logCount });

  return (
    <View style={styles.wrap}>
      {title?.title ? (
        <Pressable
          testID={`monthly-title-${monthKey}`}
          onPress={() => setOpen(true)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`月次タイトル ${title.title}`}
          accessibilityHint="タイトルを編集します"
        >
          <Text style={[styles.title, compact && styles.titleCompact]}>{title.title}</Text>
        </Pressable>
      ) : (
        <Pressable
          testID={`monthly-title-cta-${monthKey}`}
          onPress={() => setOpen(true)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LABELS.titleThisMonth}
        >
          <Text style={styles.cta}>{LABELS.titleThisMonth}</Text>
        </Pressable>
      )}

      <TitleEditor
        visible={open}
        heading={formatMonthEyebrow(monthKey)}
        initialTitle={title?.title ?? ''}
        candidates={candidates.data ?? []}
        loadingCandidates={candidates.isPending}
        aiAvailable={aiAvailable}
        onRequestCandidates={() =>
          candidates.mutate({
            periodType: 'month',
            periodKey: monthKey,
            periodLabel: formatMonthEyebrow(monthKey),
          })
        }
        onConfirm={(value, source) => {
          save.mutate({
            periodType: 'month',
            periodKey: monthKey,
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
  title: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 31, color: colors.ivory },
  titleCompact: { fontSize: 18, lineHeight: 26 },
  cta: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1, color: colors.brassDim },
});
