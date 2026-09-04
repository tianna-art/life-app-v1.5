import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { GENERIC_PROMPT, pickPrompt } from '@/constants/categories';
import type { Category, LogType, NewLogInput } from '@/types';
import { LogTypeToggle } from './LogTypeToggle';
import { CategorySelector } from './CategorySelector';
import { CategoryPrompt } from './CategoryPrompt';

interface LogComposerProps {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onSave: (input: NewLogInput) => void;
  saving?: boolean;
}

/**
 * The composer (spec §3.3–§3.6).
 *
 *  - type required, category required, body required
 *  - 出来事 gets a compact field, つぶやき a tall one
 *  - × on the left resets the form, ✓ on the right saves
 */
export function LogComposer({
  visible,
  categories,
  onClose,
  onSave,
  saving = false,
}: LogComposerProps) {
  const [type, setType] = useState<LogType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [promptSeed, setPromptSeed] = useState(() => Math.random());
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!visible) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  const prompt = useMemo(() => {
    if (!selectedCategory) return null;
    const examples =
      selectedCategory.promptExamples.length > 0
        ? selectedCategory.promptExamples
        : [GENERIC_PROMPT];
    return pickPrompt(examples, promptSeed);
  }, [selectedCategory, promptSeed]);

  function reset() {
    setType(null);
    setCategoryId(null);
    setBody('');
    setShowErrors(false);
  }

  const bodyValid = body.trim().length > 0;
  const canSave = type !== null && categoryId !== null && bodyValid;

  const handleSave = () => {
    if (!canSave || !type || !categoryId) {
      setShowErrors(true);
      return;
    }
    onSave({ type, categoryId, body: body.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="閉じる" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.centerer}
        pointerEvents="box-none"
      >
        <View style={styles.sheet} testID="log-composer">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>なにを残す？</Text>
            <LogTypeToggle
              value={type}
              onChange={(next) => {
                setType(next);
                setShowErrors(false);
              }}
            />
            {showErrors && type === null ? (
              <Text style={styles.error}>出来事かつぶやきを選んでください。</Text>
            ) : null}

            <Text style={styles.sectionLabel}>どの引き出しに？</Text>
            <CategorySelector
              categories={categories}
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next);
                setPromptSeed(Math.random());
                setShowErrors(false);
              }}
            />
            {showErrors && categoryId === null ? (
              <Text style={styles.error}>カテゴリーを選んでください。</Text>
            ) : null}

            <CategoryPrompt prompt={prompt} />

            <TextInput
              testID="log-body-input"
              value={body}
              onChangeText={setBody}
              multiline
              style={[styles.input, type === 'thought' ? styles.inputTall : styles.inputCompact]}
              placeholder={type === 'thought' ? 'いま思っていることを。' : '起きたことを一行で。'}
              placeholderTextColor={colors.ivoryFaint}
              accessibilityLabel="本文"
              textAlignVertical="top"
            />
            {showErrors && !bodyValid ? (
              <Text style={styles.error}>本文を入力してください。</Text>
            ) : null}
          </ScrollView>

          {/* × left = reset, ✓ right = save. Order is fixed by the spec. */}
          <View style={styles.footer}>
            <Pressable
              testID="composer-reset"
              onPress={reset}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="入力内容をリセット"
              style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
            >
              <Text style={styles.reset}>×</Text>
            </Pressable>

            <Pressable
              testID="composer-save"
              onPress={handleSave}
              disabled={saving}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="保存"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
            >
              <Text style={[styles.save, !canSave && styles.saveIdle]}>✓</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  centerer: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassFaint,
    overflow: 'hidden',
  },
  content: { padding: spacing.gallery, gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
    marginTop: spacing.sm,
  },
  input: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  inputCompact: { minHeight: 78 },
  inputTall: { minHeight: 190 },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.frameSoft,
  },
  footerButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  reset: { fontSize: 26, color: colors.ivoryFaint, lineHeight: 30 },
  save: { fontSize: 26, color: colors.brass, lineHeight: 30 },
  saveIdle: { color: colors.brassDim },
});
