import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { HOME } from '@/constants/copy';
import { TypeToggle } from './TypeToggle';
import { SignalPicker } from './SignalPicker';
import type { EntryType, NewEntryInput, SubjectiveSignal } from '@/types';

interface EntryComposerProps {
  onSave: (input: NewEntryInput) => void;
  saving?: boolean;
}

/**
 * The whole input surface (§4).
 *
 * Open the app, tap a drawer, write a sentence, tap a mark, press ✓. There is
 * no modal to open, no prompt question to answer, no tag to pick and no
 * category to maintain — every one of those would be the app asking the person
 * to think, which is the job it took over (§5).
 *
 * The field is always mounted, so the first tap lands in the text rather than
 * on a button that reveals the text. Target: ten seconds.
 */
export function EntryComposer({ onSave, saving = false }: EntryComposerProps) {
  const [type, setType] = useState<EntryType | null>(null);
  const [body, setBody] = useState('');
  const [signal, setSignal] = useState<SubjectiveSignal | null>(null);

  const bodyValid = body.trim().length > 0;
  const canSave = type !== null && bodyValid && signal !== null && !saving;
  const started = type !== null || body.length > 0 || signal !== null;

  const handleSave = () => {
    if (!type || !bodyValid || !signal || saving) return;
    onSave({ type, body: body.trim(), subjectiveSignal: signal });
    setType(null);
    setBody('');
    setSignal(null);
  };

  const reset = () => {
    setType(null);
    setBody('');
    setSignal(null);
  };

  return (
    <View style={styles.wrap} testID="entry-composer">
      <Text style={styles.question} accessibilityRole="header">
        {HOME.question}
      </Text>

      <TypeToggle value={type} onChange={setType} />

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
        <SignalPicker value={signal} onChange={setSignal} />

        <View style={styles.right}>
          {started ? (
            <Pressable
              testID="composer-reset"
              onPress={reset}
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center' },
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
