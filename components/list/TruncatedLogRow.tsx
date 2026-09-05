import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { formatShortDate } from '@/utils/period';
import { logTypeLabel, momentTagLabel } from '@/constants/log';
import { truncate } from '@/utils/text';
import type { DailyLog } from '@/types';

/**
 * One row of the archive.
 *
 * LIST is where someone looks something up, so it stays readable rather than
 * artistic (§28). What it shows is what the person themselves put there: the
 * date, the category, what kind of moment it was, and their own words if they
 * wrote any.
 *
 * The tags do the work that a mood column would do elsewhere. v4 has no
 * separate feeling field — 楽しかった and モヤモヤ are tags like the rest, and
 * §10 is explicit that neither is a verdict, so they are drawn the same as
 * 初めて or 変えてみた rather than coloured by sentiment.
 */
export function TruncatedLogRow({
  entry,
  onPress,
  maxChars = 20,
}: {
  entry: DailyLog;
  onPress: (id: string) => void;
  maxChars?: number;
}) {
  const written = entry.optionalAnswer || entry.body || '';
  const preview = truncate(written, maxChars);
  const tags = entry.momentTags.map(momentTagLabel);

  return (
    <Pressable
      testID={`log-row-${entry.id}`}
      onPress={() => onPress(entry.id)}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${formatShortDate(entry.occurredOn)} ${logTypeLabel(
        entry.logType
      )} ${tags.join('、')} ${preview}`}
      accessibilityHint="記録の全文を開きます"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.date}>{formatShortDate(entry.occurredOn)}</Text>

      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={styles.category}>{logTypeLabel(entry.logType)}</Text>
          {tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>

        {/* Most records have no free text (§14). The row is complete without
            it — the category and the tags already say what was left. */}
        {preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  date: {
    fontFamily: fonts.sans,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.brassDim,
    paddingTop: 1,
    minWidth: 38,
  },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  category: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ivory,
  },
  tag: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ivoryFaint,
  },
  preview: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ivoryDim,
  },
});
