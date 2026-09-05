import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { HOME } from '@/constants/copy';
import { CategoryChips } from './CategoryChips';
import type { InputCategory, NewEntryInput } from '@/types';

interface GainComposerProps {
  onSave: (input: NewEntryInput) => void;
  saving?: boolean;
}

/**
 * The whole input surface (§7).
 *
 * Open the app, tap one of three chips, write a sentence, press ✓. There is no
 * modal to open, no type to choose, no prompt question to answer and no tag to
 * pick — every one of those would be the app asking the person to think, which
 * is the job it took over.
 *
 * The field is always mounted, so the first tap lands in the text, not on a
 * button that reveals the text.
 */
export function GainComposer({ onSave, saving = false }: GainComposerProps) {
  const [category, setCategory] = useState<InputCategory | null>(null);
  const [body, setBody] = useState('');

  const bodyValid = body.trim().length > 0;
  const canSave = category !== null && bodyValid && !saving;
  const started = category !== null || body.length > 0;

  const handleSave = () => {
    if (!category || !bodyValid || saving) return;
    onSave({ inputCategory: category, body: body.trim() });
    setCategory(null);
    setBody('');
  };

  return (
    <View style={styles.wrap} testID="gain-composer">
      <Text style={styles.question} accessibilityRole="header">
        {HOME.question}
      </Text>

      <CategoryChips value={category} onChange={setCategory} />

      <TextInput
        testID="entry-body-input"
        value={body}
        onChangeText={setBody}
        multiline
        style={styles.input}
        placeholder={HOME.placeholder}
        placeholderTextColor={colors.ivoryFaint}
        accessibilityLabel={HOME.question}
        textAlignVertical="top"
        onSubmitEditing={handleSave}
      />

      <View style={styles.actions}>
        {started ? (
          <Pressable
            testID="composer-reset"
            onPress={() => {
              setCategory(null);
              setBody('');
            }}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={HOME.reset}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.reset}>×</Text>
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
  wrap: { gap: spacing.md },
  question: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 32,
    color: colors.ivory,
  },
  input: {
    minHeight: 88,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 26,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  reset: { fontSize: 22, color: colors.ivoryFaint, lineHeight: 26 },
  save: { fontSize: 24, color: colors.brass, lineHeight: 28 },
  saveIdle: { color: colors.frame },
});
