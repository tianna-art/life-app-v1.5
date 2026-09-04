import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import { Markdown } from '@components/ui/Markdown';
import { HairlineRule } from '@components/ui/HairlineRule';
import { BrassButton } from '@components/ui/BrassButton';
import { KeywordReview } from './KeywordReview';
import { buildCategoryArticle } from '@/ai/article';
import type { CategoryInsight, KeywordCandidate, LogWithAnalysis } from '@/types';

interface CategoryArticleProps {
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
 * The category opened as an article: a full-height reading surface rather than
 * a peeking sheet, because on a phone a summary worth reading needs the screen.
 */
export function CategoryArticle({
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
}: CategoryArticleProps) {
  const [keywordsOpen, setKeywordsOpen] = useState(false);

  const close = () => {
    setKeywordsOpen(false);
    onClose();
  };

  const article = buildCategoryArticle({ categoryName, periodLabel, insight, logs });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.bar}>
            <Pressable
              testID="article-close"
              onPress={close}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="閉じる"
              style={styles.barButton}
            >
              <Text style={styles.barLabel}>‹　もどる</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            testID="category-article"
          >
            {loading ? (
              <Text style={styles.loading}>読みこんでいます…</Text>
            ) : (
              <Markdown source={article} />
            )}

            {logs.length > 0 ? (
              <>
                <HairlineRule />
                <Text style={styles.sectionLabel}>ひとつずつ読む</Text>
                <View>
                  {logs.map((log) => (
                    <Pressable
                      key={log.id}
                      testID={`article-log-${log.id}`}
                      onPress={() => onLogPress(log.id)}
                      hitSlop={HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={log.body}
                      style={({ pressed }) => [styles.logRow, pressed && styles.pressed]}
                    >
                      <Text style={styles.logDate}>{log.occurredOn.slice(5).replace('-', '/')}</Text>
                      <Text style={styles.logBody} numberOfLines={2}>
                        {log.body}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

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
                disabled={!insight}
                style={styles.keywordButton}
                accessibilityHint="AIが抽出した最大3つのキーワードを表示します"
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
  bar: {
    paddingHorizontal: spacing.gallery,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frameSoft,
  },
  barButton: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  barLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  content: {
    paddingHorizontal: spacing.gallery,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  loading: { fontFamily: fonts.serif, fontSize: 15, color: colors.ivoryFaint },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
  },
  logRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm + 2 },
  pressed: { opacity: 0.6 },
  logDate: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim, width: 44 },
  logBody: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.ivory },
  keywordButton: { alignSelf: 'flex-start', marginTop: spacing.md },
});
