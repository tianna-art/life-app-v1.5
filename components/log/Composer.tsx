import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { categoriesForMonth, categoryById } from '@/constants/antennas';
import { Chip } from '@components/ui/Chip';
import { VoiceEntry } from '@components/ui/VoiceEntry';
import type { AntennaId, NewLogInput } from '@/types';

interface ComposerProps {
  /** The month being written into, `YYYY-MM`. */
  periodKey: string;
  /** The day, or null when only the month is known. */
  occurredOn: string | null;
  antennaIds: readonly AntennaId[];
  onSave: (input: NewLogInput) => void;
  saving?: boolean;
}

/**
 * ひとこと記録 — one line, then optionally what kind of thing it was.
 *
 * The order matters and is not negotiable: you write first, and only then are
 * you asked to say anything about it. Asking for a category before the body
 * makes the person classify an event they have not yet put into words, which
 * is a different and much harder task than remembering their day.
 *
 * Every step after the body is optional. A record with no tag is a record.
 */
export function Composer({
  periodKey,
  occurredOn,
  antennaIds,
  onSave,
  saving = false,
}: ComposerProps) {
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const categories = useMemo(() => categoriesForMonth(antennaIds), [antennaIds]);
  const written = body.trim().length > 0;
  const category = categoryId ? categoryById(categoryId) : undefined;

  const reset = () => {
    setBody('');
    setCategoryId(null);
    setDetailId(null);
  };

  const save = () => {
    if (!written) return;
    onSave({
      body: body.trim(),
      occurredOn,
      periodKey,
      categoryId,
      detailId,
    });
    reset();
  };

  return (
    <View style={styles.wrap} testID="composer">
      <Text style={styles.prompt}>{COPY.logLead}</Text>

      <TextInput
        testID="composer-body"
        value={body}
        onChangeText={setBody}
        multiline
        style={styles.input}
        placeholderTextColor={colors.brownFaint}
        accessibilityLabel="ひとこと記録の本文"
        textAlignVertical="top"
      />

      {/* Under the field, as in the preview: the transcript would land in the
          body above, unedited. */}
      <VoiceEntry testID="composer-voice" />

      {/* 2/3 — what kind of thing it was. Appears once there is something to
          describe, and not before. */}
      {written ? (
        <View style={styles.step} testID="composer-step-category">
          <Text style={styles.question}>
            {COPY.step2q} <Text style={styles.count}>(2/3)</Text>
          </Text>
          <View style={styles.chips}>
            {categories.map((c) => (
              <Chip
                key={c.id}
                testID={`category-${c.id}`}
                label={c.label}
                selected={categoryId === c.id}
                onPress={() => {
                  const next = categoryId === c.id ? null : c.id;
                  setCategoryId(next);
                  // The detail belongs to the category; keeping it across a
                  // change would file the record under a narrowing of
                  // something else.
                  setDetailId(null);
                }}
              />
            ))}
          </View>
          <Text style={styles.note}>{COPY.tagOptional}</Text>
        </View>
      ) : null}

      {/* 3/3 — the narrowing, which only exists once a category is chosen. */}
      {category ? (
        <View style={styles.step} testID="composer-step-detail">
          <Text style={styles.question}>
            {category.detailQuestion} <Text style={styles.count}>(3/3)</Text>
          </Text>
          <View style={styles.chips}>
            {category.details.map((d) => (
              <Chip
                key={d.id}
                testID={`detail-${d.id}`}
                label={d.label}
                selected={detailId === d.id}
                onPress={() => setDetailId(detailId === d.id ? null : d.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          testID="composer-reset"
          onPress={reset}
          disabled={!written && categoryId === null}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="入力内容を消す"
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <Text style={styles.cancel}>×</Text>
        </Pressable>

        <Pressable
          testID="composer-save"
          onPress={save}
          disabled={!written || saving}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="記録する"
          accessibilityState={{ disabled: !written || saving }}
          style={({ pressed }) => [
            styles.round,
            styles.primary,
            !written && styles.primaryIdle,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.check, !written && styles.checkIdle]}>✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  prompt: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1.4, color: colors.brownFaint },
  input: {
    minHeight: 96,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 26,
  },
  step: { gap: spacing.sm },
  question: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 1.2, color: colors.brownDim },
  count: { color: colors.brownFaint, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 18, color: colors.brownFaint },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  primary: { backgroundColor: colors.brown, borderColor: colors.brown },
  primaryIdle: { backgroundColor: colors.paper, borderColor: colors.hairline },
  pressed: { opacity: 0.62 },
  cancel: { fontSize: 20, color: colors.brown, lineHeight: 24 },
  check: { fontSize: 20, color: colors.onBrown, lineHeight: 24 },
  checkIdle: { color: colors.brownFaint },
});
