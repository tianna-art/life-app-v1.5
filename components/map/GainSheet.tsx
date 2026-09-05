import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { GAIN_TYPE_JA, GAIN_TYPE_LABEL, JOURNEY_ROLE_JA } from '@/constants/gain';
import { formatShortDate } from '@/utils/period';
import type { GainDetail, GainVerdict } from '@/types';

interface GainSheetProps {
  visible: boolean;
  detail: GainDetail | null;
  loading: boolean;
  onClose: () => void;
  onVerdict: (input: { verdict: GainVerdict; label?: string }) => void;
  onEvidencePress: (logId: string) => void;
  busy?: boolean;
}

/**
 * What a gain is, and how it came about (§17, §27).
 *
 * The path matters as much as the gain: a strategy that arrived after
 * something did not work is shown with that failure still in it, in the order
 * it happened. Nothing here is rewritten into a success story, and the
 * feedback is two options — anything larger would be another form to fill in.
 */
export function GainSheet({
  visible,
  detail,
  loading,
  onClose,
  onVerdict,
  onEvidencePress,
  busy = false,
}: GainSheetProps) {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setDraft(null);
  }, [visible]);

  const gain = detail?.gain;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="閉じる" />
      <View style={styles.sheet} testID="gain-sheet">
        <View style={styles.grip} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {loading || !gain ? (
            <Text style={styles.dim}>{loading ? '読み込んでいます。' : '見つかりませんでした。'}</Text>
          ) : (
            <>
              <Text style={styles.plate}>
                {GAIN_TYPE_LABEL[gain.type]}
                <Text style={styles.plateJa}>{`　${GAIN_TYPE_JA[gain.type]}`}</Text>
              </Text>

              <Text style={styles.label} accessibilityRole="header">
                {gain.label}
              </Text>

              <Text style={styles.section}>{LABELS.howItFormed}</Text>

              {detail.formation.length <= 1 ? (
                <Text style={styles.dim}>{EMPTY_STATE.gainDetail}</Text>
              ) : null}

              <View style={styles.path}>
                {detail.formation.map((step, index) => (
                  <View key={step.logId} style={styles.step}>
                    {index > 0 ? <Text style={styles.arrow}>↓</Text> : null}
                    <Pressable
                      onPress={() => onEvidencePress(step.logId)}
                      hitSlop={HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatShortDate(step.occurredOn)} ${step.eventSummary}`}
                      accessibilityHint="この記録を開きます"
                      style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
                    >
                      <Text style={styles.stepDate}>{formatShortDate(step.occurredOn)}</Text>
                      <View style={styles.stepBody}>
                        <Text style={styles.stepRole}>{JOURNEY_ROLE_JA[step.journeyRole]}</Text>
                        <Text style={styles.stepSummary}>{step.eventSummary}</Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>

              {draft === null ? (
                <View style={styles.verdicts}>
                  <Pressable
                    testID="verdict-accept"
                    onPress={() => onVerdict({ verdict: 'accepted' })}
                    disabled={busy}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.accepted}
                    style={({ pressed }) => [styles.verdict, pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.verdictLabel,
                        gain.verdict === 'accepted' && styles.verdictLabelActive,
                      ]}
                    >
                      {LABELS.accepted}
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="verdict-adjust"
                    onPress={() => setDraft(gain.label)}
                    disabled={busy}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.adjusted}
                    style={({ pressed }) => [styles.verdict, pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.verdictLabel,
                        gain.verdict === 'adjusted' && styles.verdictLabelActive,
                      ]}
                    >
                      {LABELS.adjusted}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.editor}>
                  <TextInput
                    testID="verdict-label-input"
                    value={draft}
                    onChangeText={setDraft}
                    style={styles.input}
                    accessibilityLabel="この Gain の言い方"
                    placeholder={gain.label}
                    placeholderTextColor={colors.ivoryFaint}
                    maxLength={40}
                    autoFocus
                  />
                  <Pressable
                    testID="verdict-label-save"
                    onPress={() => {
                      const label = draft.trim();
                      onVerdict({ verdict: 'adjusted', ...(label ? { label } : {}) });
                      setDraft(null);
                    }}
                    disabled={busy}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.saveEdit}
                    style={({ pressed }) => [styles.verdict, pressed && styles.pressed]}
                  >
                    <Text style={styles.verdictLabelActive}>{LABELS.saveEdit}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="閉じる"
          style={styles.close}
        >
          <Text style={styles.closeLabel}>閉じる</Text>
        </Pressable>
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
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    paddingHorizontal: spacing.gallery,
    paddingBottom: spacing.lg,
    backgroundColor: colors.night,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 2,
    marginVertical: spacing.md,
    backgroundColor: colors.frame,
  },
  scroll: { gap: spacing.md, paddingBottom: spacing.lg },
  plate: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2.6, color: colors.brassDim },
  plateJa: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1, color: colors.ivoryFaint },
  label: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 34, color: colors.ivory },
  section: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 2.8,
    color: colors.ivoryFaint,
    marginTop: spacing.sm,
  },
  dim: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 21, color: colors.ivoryFaint },
  path: { gap: spacing.xs },
  step: { gap: spacing.xs },
  arrow: { fontFamily: fonts.sans, fontSize: 13, color: colors.brassDim, paddingLeft: 20 },
  stepRow: { flexDirection: 'row', gap: spacing.md, minHeight: MIN_TOUCH - 12, alignItems: 'flex-start' },
  pressed: { opacity: 0.6 },
  stepDate: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim, width: 44, paddingTop: 2 },
  stepBody: { flex: 1, gap: 2 },
  stepRole: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.4, color: colors.ivoryFaint },
  stepSummary: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.ivory },
  verdicts: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  editor: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: MIN_TOUCH - 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 18,
  },
  verdict: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  verdictLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.ivoryDim },
  verdictLabelActive: { fontFamily: fonts.sans, fontSize: 14, color: colors.brass },
  close: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1.6, color: colors.ivoryFaint },
});
