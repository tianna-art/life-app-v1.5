import { useEffect, useState } from 'react';
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
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { EVIDENCE_ROLE_JA } from '@/constants/progression';
import { phraseForMaturity } from '@/ai/progressionRules';
import { HairlineRule } from '@components/ui/HairlineRule';
import { formatShortDate } from '@/utils/period';
import type { ProgressionDetail, ProgressionVerdict } from '@/types';

interface ProgressionSheetProps {
  detail: ProgressionDetail | null | undefined;
  onClose: () => void;
  onOpenLog: (logId: string) => void;
  onVerdict: (input: {
    verdict: ProgressionVerdict;
    title?: string;
    summary?: string;
  }) => void;
}

/**
 * What a progression is, spelled out (§21).
 *
 * Title, one line of summary, the path it took, and — only if something has
 * actually settled — what remains. The path is the argument: §13 forbids
 * telling the person they have changed, so the screen shows the records in
 * order and lets them read it.
 *
 * The maturity line is generated from the rung, so a progression standing on
 * two records says "兆しがあります" and cannot say anything louder.
 */
export function ProgressionSheet({
  detail,
  onClose,
  onOpenLog,
  onVerdict,
}: ProgressionSheetProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');

  const progression = detail?.progression;

  // Reopening a different progression must not carry the last one's draft.
  useEffect(() => {
    setEditing(false);
    setDraftTitle(progression?.title ?? '');
    setDraftSummary(progression?.summary ?? '');
  }, [progression?.id, progression?.title, progression?.summary]);

  const open = Boolean(detail);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={LABELS.back} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet} testID="progression-sheet">
          {progression ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* Closing was only the scrim behind the sheet and the system
                  back gesture. Neither is visible, so on a screen that opens
                  by tapping a point there was nothing that looked like a way
                  out. It sits above the title rather than beside it: the
                  title runs to two lines often enough that anything sharing
                  its row would move around. */}
              <Pressable
                testID="sheet-close"
                onPress={onClose}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={LABELS.close}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <Text style={styles.closeGlyph}>×</Text>
              </Pressable>

              {editing ? (
                <TextInput
                  testID="progression-title-input"
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  style={styles.titleInput}
                  accessibilityLabel={LABELS.adjusted}
                />
              ) : (
                <Text style={styles.title}>{progression.title}</Text>
              )}

              <Text style={styles.maturity}>
                {phraseForMaturity(progression.maturity, progression.title)}
              </Text>

              <HairlineRule />

              {editing ? (
                <TextInput
                  testID="progression-summary-input"
                  value={draftSummary}
                  onChangeText={setDraftSummary}
                  multiline
                  style={styles.summaryInput}
                  accessibilityLabel={LABELS.adjusted}
                />
              ) : progression.summary ? (
                <Text style={styles.summary}>{progression.summary}</Text>
              ) : null}

              {detail && detail.steps.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{LABELS.path}</Text>
                  {detail.steps.map((step, index) => (
                    <Pressable
                      key={step.logId}
                      testID={`step-${step.logId}`}
                      onPress={() => onOpenLog(step.logId)}
                      hitSlop={HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatShortDate(step.occurredOn)} ${step.eventSummary}`}
                      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                    >
                      {/* The arrow is the only thing that says "then". No
                          numbering: a step is not a level. */}
                      {index > 0 ? <Text style={styles.arrow}>↓</Text> : null}
                      <View style={styles.stepBody}>
                        <Text style={styles.stepDate}>{formatShortDate(step.occurredOn)}</Text>
                        <Text style={styles.stepText}>{step.eventSummary}</Text>
                        <Text style={styles.stepRole}>{EVIDENCE_ROLE_JA[step.role]}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.dim}>{EMPTY_STATE.progressionDetail}</Text>
              )}

              {/* Only when something actually settled. Most progressions never
                  reach this, and the section is simply absent (§21, §22). */}
              {detail && detail.gains.length > 0 ? (
                <View style={styles.section}>
                  <HairlineRule />
                  <Text style={styles.sectionLabel}>{LABELS.whatYouGained}</Text>
                  {detail.gains.map((gain) => (
                    <View key={gain.id} style={styles.gain}>
                      <Text style={styles.gainLabel}>{gain.label}</Text>
                      {gain.description ? (
                        <Text style={styles.gainDescription}>{gain.description}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <HairlineRule />

              {editing ? (
                <Pressable
                  testID="progression-save-edit"
                  onPress={() => {
                    onVerdict({
                      verdict: 'adjusted',
                      title: draftTitle.trim() || progression.title,
                      summary: draftSummary.trim(),
                    });
                    setEditing(false);
                  }}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={LABELS.saveEdit}
                  style={({ pressed }) => [styles.verdictButton, pressed && styles.pressed]}
                >
                  <Text style={styles.verdictActive}>{LABELS.saveEdit}</Text>
                </Pressable>
              ) : (
                <View style={styles.verdictRow}>
                  <Pressable
                    testID="verdict-accepted"
                    onPress={() => onVerdict({ verdict: 'accepted' })}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.accepted}
                    style={({ pressed }) => [styles.verdictButton, pressed && styles.pressed]}
                  >
                    <Text
                      style={
                        progression.verdict === 'accepted'
                          ? styles.verdictActive
                          : styles.verdict
                      }
                    >
                      {LABELS.accepted}
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="verdict-adjusted"
                    onPress={() => setEditing(true)}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.adjusted}
                    style={({ pressed }) => [styles.verdictButton, pressed && styles.pressed]}
                  >
                    <Text
                      style={
                        progression.verdict === 'adjusted'
                          ? styles.verdictActive
                          : styles.verdict
                      }
                    >
                      {LABELS.adjusted}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  scroll: { padding: spacing.gallery, gap: spacing.md },
  close: {
    alignSelf: 'flex-start',
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    marginTop: -spacing.sm,
    marginLeft: -spacing.sm,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 24, lineHeight: 28, color: colors.ivoryFaint },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 34, color: colors.ivory },
  titleInput: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 34,
    color: colors.ivory,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brassDim,
    paddingVertical: spacing.xs,
  },
  maturity: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryFaint },
  summary: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 26, color: colors.ivoryDim },
  summaryInput: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 26,
    color: colors.ivory,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brassDim,
    textAlignVertical: 'top',
  },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 3,
    color: colors.ivoryFaint,
  },
  step: { gap: 2 },
  arrow: { fontFamily: fonts.sans, fontSize: 12, color: colors.frame, marginVertical: 2 },
  stepBody: { gap: 2 },
  stepDate: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.4, color: colors.ivoryFaint },
  stepText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.ivory },
  stepRole: { fontFamily: fonts.sans, fontSize: 10, color: colors.brassDim },
  gain: { gap: 2 },
  gainLabel: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, color: colors.ivory },
  gainDescription: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.ivoryDim },
  dim: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.ivoryFaint },
  verdictRow: { flexDirection: 'row', gap: spacing.lg },
  verdictButton: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  verdict: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  verdictActive: { fontFamily: fonts.sans, fontSize: 13, color: colors.brass },
});
