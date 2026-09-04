import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { GENERIC_PROMPT, pickPrompt } from '@/constants/categories';
import type { Category, LogType, NewLogInput } from '@/types';
import { LogTypeToggle } from './LogTypeToggle';
import { CategorySelector } from './CategorySelector';
import { CategoryPrompt } from './CategoryPrompt';

interface InlineComposerProps {
  categories: Category[];
  onSave: (input: NewLogInput) => void;
  saving?: boolean;
}

/**
 * Writing happens here, on the page — no button to press first and no sheet to
 * wait for. The field is the first thing under the month, so the shortest path
 * from opening the app to leaving a record is: tap, type, ✓.
 *
 * The three requirements are unchanged: a type, a category, and a body.
 */
export function InlineComposer({ categories, onSave, saving = false }: InlineComposerProps) {
  const [type, setType] = useState<LogType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [promptSeed, setPromptSeed] = useState(() => Math.random());
  const [showErrors, setShowErrors] = useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  const prompt = useMemo(() => {
    if (!selectedCategory) return null;
    const examples =
      selectedCategory.promptExamples.length > 0 ? selectedCategory.promptExamples : [GENERIC_PROMPT];
    return pickPrompt(examples, promptSeed);
  }, [selectedCategory, promptSeed]);

  const reset = () => {
    setType(null);
    setCategoryId(null);
    setBody('');
    setShowErrors(false);
  };

  const bodyValid = body.trim().length > 0;
  const canSave = type !== null && categoryId !== null && bodyValid;
  const started = type !== null || categoryId !== null || body.length > 0;

  const handleSave = () => {
    if (!canSave || !type || !categoryId) {
      setShowErrors(true);
      return;
    }
    onSave({ type, categoryId, body: body.trim() });
    reset();
  };

  return (
    <View style={styles.wrap} testID="inline-composer">
      <LogTypeToggle
        value={type}
        onChange={(next) => {
          setType(next);
          setShowErrors(false);
        }}
      />

      <CategorySelector
        categories={categories}
        value={categoryId}
        onChange={(next) => {
          setCategoryId(next);
          setPromptSeed(Math.random());
          setShowErrors(false);
        }}
      />

      <CategoryPrompt prompt={prompt} />

      <TextInput
        testID="log-body-input"
        value={body}
        onChangeText={setBody}
        multiline
        style={[styles.input, type === 'thought' ? styles.inputTall : styles.inputCompact]}
        placeholder={
          type === 'thought' ? 'いま思っていることを。' : 'ここに書けます。起きたことを一行で。'
        }
        placeholderTextColor={colors.ivoryFaint}
        accessibilityLabel="本文"
        textAlignVertical="top"
      />

      {showErrors && !canSave ? (
        <Text style={styles.error}>
          {type === null
            ? '出来事かつぶやきを選んでください。'
            : categoryId === null
              ? 'どの引き出しに入れるか選んでください。'
              : '本文を入力してください。'}
        </Text>
      ) : null}

      {/* × left = reset, ✓ right = save. Order is fixed by the spec. */}
      <View style={styles.actions}>
        <Pressable
          testID="composer-reset"
          onPress={reset}
          disabled={!started}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="入力内容をリセット"
          accessibilityState={{ disabled: !started }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[styles.reset, !started && styles.idle]}>×</Text>
        </Pressable>

        <Pressable
          testID="composer-save"
          onPress={handleSave}
          disabled={saving}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="保存"
          accessibilityState={{ disabled: saving }}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={[styles.save, !canSave && styles.saveIdle]}>✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  inputCompact: { minHeight: 72 },
  inputTall: { minHeight: 152 },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  reset: { fontSize: 24, color: colors.ivoryFaint, lineHeight: 28 },
  idle: { color: colors.frame },
  save: { fontSize: 24, color: colors.brass, lineHeight: 28 },
  saveIdle: { color: colors.brassDim },
});
