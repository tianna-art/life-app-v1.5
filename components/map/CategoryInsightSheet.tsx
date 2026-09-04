import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { BrassButton } from '@components/ui/BrassButton';
import { HairlineRule } from '@components/ui/HairlineRule';
import { KeywordReview } from './KeywordReview';
import { formatShortDate } from '@/utils/period';
import { truncate } from '@/utils/text';
import type { CategoryInsight, KeywordCandidate, LogWithAnalysis } from '@/types';

interface CategoryInsightSheetProps {
  visible: boolean;
  categoryName: string;
  periodLabel: string;
  insight: CategoryInsight | null;
  loading: boolean;
  logs: LogWithAnalysis[];
  onClose: () => void;
  onLogPress: (logId: string) => void;
  onKeywordAccept: (keywords: KeywordCandidate[]) => void;
  onKeywordEdit: (keywords: KeywordCandidate[]) => void;
  onKeywordSkip: () => void;
  reviewBusy?: boolean;
}

/**
 * Category detail (spec §7): insight on top, related logs below, and the
 * keyword panel revealed only after the user asks for it.
 */
export function CategoryInsightSheet({
  visible,
  categoryName,
  periodLabel,
  insight,
  loading,
  logs,
  onClose,
  onLogPress,
  onKeywordAccept,
  onKeywordEdit,
  onKeywordSkip,
  reviewBusy = false,
}: CategoryInsightSheetProps) {
  const [keywordsOpen, setKeywordsOpen] = useState(false);

  const close = () => {
    setKeywordsOpen(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="閉じる" />
      <View style={styles.sheet} testID="category-insight-sheet">
        <View style={styles.grip} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.period}>{periodLabel}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {categoryName}
          </Text>

          <HairlineRule />

          <Text style={styles.sectionLabel}>INSIGHT</Text>
          <Text style={styles.insight}>
            {loading
              ? '…'
              : (insight?.insight ??
                'この期間のこのカテゴリーについては、まだ言葉にできることが多くありません。')}
          </Text>

          <HairlineRule />

          <Text style={styles.sectionLabel}>関連する記録</Text>
          <View style={styles.logList}>
            {logs.map((log) => (
              <Pressable
                key={log.id}
                onPress={() => onLogPress(log.id)}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`${formatShortDate(log.occurredOn)} ${truncate(log.body, 40)}`}
                style={({ pressed }) => [styles.logRow, pressed && styles.logRowPressed]}
              >
                <Text style={styles.logDate}>{formatShortDate(log.occurredOn)}</Text>
                <Text style={styles.logBody} numberOfLines={1}>
                  {truncate(log.body, 26)}
                </Text>
                <Text style={styles.logType}>
                  {log.type === 'event' ? LABELS.event : LABELS.thought}
                </Text>
              </Pressable>
            ))}
          </View>

          {keywordsOpen && insight ? (
            <>
              <HairlineRule />
              <Text style={styles.sectionLabel}>KEYWORDS</Text>
              <KeywordReview
                keywords={insight.keywords}
                status={insight.status}
                onAccept={() => onKeywordAccept(insight.keywords.slice(0, 3))}
                onEditConfirm={onKeywordEdit}
                onSkip={onKeywordSkip}
                busy={reviewBusy}
              />
            </>
          ) : (
            <BrassButton
              testID="see-keywords"
              label={LABELS.seeKeywords}
              onPress={() => setKeywordsOpen(true)}
              style={styles.keywordButton}
              disabled={!insight}
              accessibilityHint="AIが抽出した最大3つのキーワードを表示します"
            />
          )}

          <Pressable
            onPress={close}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            style={styles.closeRow}
          >
            <Text style={styles.close}>閉じる</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassFaint,
  },
  grip: {
    alignSelf: 'center',
    width: 42,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.frame,
    marginTop: spacing.sm,
  },
  content: { padding: spacing.gallery, gap: spacing.md, paddingBottom: spacing.xxl },
  period: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3, color: colors.brassDim },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ivory },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
  },
  insight: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 29, color: colors.ivory },
  logList: { gap: spacing.xs },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  logRowPressed: { opacity: 0.6 },
  logDate: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim, width: 44 },
  logBody: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ivory },
  logType: { fontFamily: fonts.sans, fontSize: 11, color: colors.ivoryFaint },
  keywordButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  closeRow: { alignSelf: 'center', marginTop: spacing.lg },
  close: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 1.2, color: colors.ivoryFaint },
});
