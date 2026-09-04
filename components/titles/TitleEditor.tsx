import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { BrassButton } from '@components/ui/BrassButton';
import { HairlineRule } from '@components/ui/HairlineRule';
import type { TitleCandidate } from '@/types';

interface TitleEditorProps {
  visible: boolean;
  heading: string;
  initialTitle: string;
  candidates: TitleCandidate[];
  loadingCandidates: boolean;
  /** Only true once the period is over AND the unlock rule is met. */
  aiAvailable: boolean;
  onRequestCandidates: () => void;
  onConfirm: (title: string, source: 'manual' | 'ai') => void;
  onClose: () => void;
}

/**
 * Manual titling is always available. The AI path only ever proposes three
 * candidates that the user picks, edits, or ignores (spec §4.5, §4.6).
 */
export function TitleEditor({
  visible,
  heading,
  initialTitle,
  candidates,
  loadingCandidates,
  aiAvailable,
  onRequestCandidates,
  onConfirm,
  onClose,
}: TitleEditorProps) {
  const [draft, setDraft] = useState(initialTitle);
  const [source, setSource] = useState<'manual' | 'ai'>('manual');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="閉じる" />
      <View style={styles.sheet} testID="title-editor">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading} accessibilityRole="header">
            {heading}
          </Text>

          <TextInput
            testID="title-input"
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setSource('manual');
            }}
            placeholder="この期間をどう呼びたい？"
            placeholderTextColor={colors.ivoryFaint}
            style={styles.input}
            accessibilityLabel="タイトル"
            multiline
            maxLength={80}
          />

          {aiAvailable ? (
            <>
              <HairlineRule />
              <BrassButton
                testID="request-candidates"
                label={loadingCandidates ? '考えています…' : 'AIに3案もらう'}
                onPress={onRequestCandidates}
                disabled={loadingCandidates}
                style={styles.aiButton}
              />
              {candidates.map((candidate) => (
                <Pressable
                  key={candidate.title}
                  testID={`candidate-${candidate.title}`}
                  onPress={() => {
                    setDraft(candidate.title);
                    setSource('ai');
                  }}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={candidate.title}
                  style={({ pressed }) => [styles.candidate, pressed && styles.pressed]}
                >
                  <Text style={styles.candidateTitle}>{candidate.title}</Text>
                  {candidate.reason ? (
                    <Text style={styles.candidateReason}>{candidate.reason}</Text>
                  ) : null}
                </Pressable>
              ))}
            </>
          ) : null}

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="やめる"
              style={styles.footerButton}
            >
              <Text style={styles.cancel}>やめる</Text>
            </Pressable>
            <BrassButton
              testID="confirm-title"
              label="このタイトルにする"
              onPress={() => onConfirm(draft.trim(), source)}
              disabled={draft.trim().length === 0}
              variant="solid"
            />
          </View>
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
    left: spacing.md,
    right: spacing.md,
    top: '12%',
    maxHeight: '76%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassFaint,
  },
  content: { padding: spacing.gallery, gap: spacing.md },
  heading: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3, color: colors.brassDim },
  input: {
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 28,
  },
  aiButton: { alignSelf: 'flex-start' },
  candidate: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frameSoft,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.6 },
  candidateTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.ivory },
  candidateReason: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 19, color: colors.ivoryFaint },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  footerButton: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  cancel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
});
