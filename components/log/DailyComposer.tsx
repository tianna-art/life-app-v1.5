import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { HOME } from '@/constants/copy';
import { getCategoryById } from '@/constants/log';
import { DatePicker } from './DatePicker';
import { CategoryPicker } from './CategoryPicker';
import { DetailPicker } from './DetailPicker';
import type { AntennaId, CategoryId, DetailId, NewLogInput } from '@/types';

interface DailyComposerProps {
  /** The month being written into, `YYYY-MM`. */
  monthKey: string;
  /** The month's antennas. Their categories are what this offers. */
  antennaIds: readonly AntennaId[];
  /** The day the composer opens on. Today, or the first of another month. */
  defaultDay: string;
  /** Days after this are not offered. Absent once the month is behind us. */
  latestDay?: string | undefined;
  onSave: (input: NewLogInput) => void;
  saving?: boolean;
}

/**
 * The whole input surface.
 *
 * Which day, which category, what about it, and what happened. Three taps and
 * a line, and the line is optional: the category and the detail are already a
 * record, and 「何があった？」 is asked the same way every time on purpose —
 * a different question per category reads as an exam, and the category label
 * has already said what kind of day it was.
 *
 * Only the month's antennas are offered. The fifteen categories exist; a month
 * is three or six of them, and that is what makes the first tap a reflex.
 *
 * The detail appears once a category is chosen, because the question above it
 * belongs to the category. Nothing is asked before there is something to ask.
 */
export function DailyComposer({
  monthKey,
  antennaIds,
  defaultDay,
  latestDay,
  onSave,
  saving = false,
}: DailyComposerProps) {
  const [day, setDay] = useState(defaultDay);
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [detailId, setDetailId] = useState<DetailId | null>(null);
  const [body, setBody] = useState('');

  const canSave = categoryId !== null && !saving;
  const started = categoryId !== null || body.length > 0;

  // Moving to another month moves the composer with it, rather than leaving
  // a day from the month the person just left.
  useEffect(() => {
    setDay(defaultDay);
  }, [defaultDay]);

  // A detail belongs to its category. Keeping one across a change of category
  // would file the record under an option that category never offered.
  useEffect(() => {
    setDetailId(null);
  }, [categoryId]);

  const reset = () => {
    setDay(defaultDay);
    setCategoryId(null);
    setDetailId(null);
    setBody('');
  };

  const handleSave = () => {
    if (!categoryId || saving) return;
    const trimmed = body.trim();
    onSave({
      categoryId,
      ...(detailId ? { detailId } : {}),
      // Midday, so a record cannot land on the day before in another
      // timezone — the day the person chose is the day it belongs to.
      occurredAt: new Date(`${day}T12:00:00Z`).toISOString(),
      ...(trimmed ? { body: trimmed } : {}),
      inputMethod: 'category',
    });
    reset();
  };

  return (
    <View style={styles.wrap} testID="daily-composer">
      <DatePicker value={day} monthKey={monthKey} onChange={setDay} latest={latestDay} />

      <View style={styles.level}>
        <Text style={styles.levelLabel}>{HOME.category}</Text>
        <CategoryPicker antennaIds={antennaIds} value={categoryId} onChange={setCategoryId} />
      </View>

      {categoryId ? (
        <View style={styles.level} testID="detail-level">
          <DetailPicker categoryId={categoryId} value={detailId} onChange={setDetailId} />
        </View>
      ) : null}

      {/* 何があった？ — the same question under every category, and answering
          it is optional. The save above is already available. */}
      {categoryId ? (
        <View style={styles.level} testID="free-text">
          <Text style={styles.question}>{getCategoryById(categoryId).freeTextPrompt}</Text>
          <TextInput
            testID="body-input"
            value={body}
            onChangeText={setBody}
            style={styles.input}
            placeholder={HOME.answerPlaceholder}
            placeholderTextColor={colors.ivoryFaint}
            accessibilityLabel={getCategoryById(categoryId).freeTextPrompt}
            accessibilityHint={HOME.answerPlaceholder}
            onSubmitEditing={handleSave}
            returnKeyType="done"
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        {started ? (
          <Pressable
            testID="composer-reset"
            onPress={reset}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={HOME.reset}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.resetGlyph}>×</Text>
          </Pressable>
        ) : (
          <View style={styles.action} />
        )}

        <Pressable
          testID="composer-save"
          onPress={handleSave}
          disabled={!canSave}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={HOME.save}
          accessibilityState={{ disabled: !canSave }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[styles.save, !canSave && styles.saveIdle]}>✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg, alignItems: 'stretch' },
  level: { gap: spacing.sm, alignItems: 'center' },
  levelLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.ivoryFaint,
    textAlign: 'center',
  },
  question: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    color: colors.ivory,
    textAlign: 'center',
  },
  input: {
    alignSelf: 'stretch',
    textAlign: 'center',
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  action: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  resetGlyph: { fontSize: 22, color: colors.ivoryFaint, lineHeight: 26 },
  save: { fontSize: 24, color: colors.brass, lineHeight: 28 },
  saveIdle: { color: colors.frame },
});
