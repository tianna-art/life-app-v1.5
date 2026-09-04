import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { LABELS } from '@/constants/copy';
import type { KeywordCandidate } from '@/types';

export const MAX_KEYWORDS = 3;

interface KeywordReviewProps {
  keywords: KeywordCandidate[];
  status: 'pending' | 'accepted' | 'edited' | 'skipped';
  onEditConfirm: (keywords: KeywordCandidate[]) => void;
  onSkip: () => void;
  onAccept: () => void;
  busy?: boolean;
}

/**
 * Keyword confirmation (spec §7.4).
 *
 * Action order is fixed: 編集 ｜ スキップ ｜ 納得した — 納得した is always the
 * rightmost control. Confidence numbers are stored but never rendered.
 */
export function KeywordReview({
  keywords,
  status,
  onEditConfirm,
  onSkip,
  onAccept,
  busy = false,
}: KeywordReviewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(() =>
    keywords.slice(0, MAX_KEYWORDS).map((k) => k.label)
  );

  const confirmEdit = () => {
    const cleaned = draft.map((d) => d.trim()).filter((d) => d.length > 0).slice(0, MAX_KEYWORDS);
    onEditConfirm(
      cleaned.map((label) => {
        const original = keywords.find((k) => k.label === label);
        return {
          label,
          confidence: original?.confidence ?? 1,
          evidenceLogIds: original?.evidenceLogIds ?? [],
        };
      })
    );
    setEditing(false);
  };

  return (
    <View style={styles.wrap} testID="keyword-review">
      {editing ? (
        <View style={styles.editList}>
          {Array.from({ length: MAX_KEYWORDS }, (_, i) => (
            <View key={i} style={styles.editRow}>
              <Text style={styles.hash}>#</Text>
              <TextInput
                testID={`keyword-input-${i}`}
                style={styles.input}
                value={draft[i] ?? ''}
                onChangeText={(value) =>
                  setDraft((current) => {
                    const next = [...current];
                    while (next.length < MAX_KEYWORDS) next.push('');
                    next[i] = value;
                    return next;
                  })
                }
                placeholder="キーワード"
                placeholderTextColor={colors.ivoryFaint}
                accessibilityLabel={`キーワード ${i + 1}`}
                maxLength={24}
              />
              {(draft[i] ?? '').length > 0 ? (
                <Pressable
                  onPress={() =>
                    setDraft((current) => current.map((v, index) => (index === i ? '' : v)))
                  }
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={`キーワード ${i + 1} を削除`}
                >
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.chipRow}>
          {keywords.slice(0, MAX_KEYWORDS).map((keyword) => (
            <View key={keyword.label} style={styles.chip}>
              <Text style={styles.chipText}>{`#${keyword.label}`}</Text>
            </View>
          ))}
        </View>
      )}

      {status !== 'pending' && !editing ? (
        <Text style={styles.statusLine}>
          {status === 'accepted'
            ? 'このキーワードは確認済みです。'
            : status === 'edited'
              ? 'あなたが編集したキーワードです。'
              : '今回は確定していません。'}
        </Text>
      ) : null}

      {/* Order is part of the spec: 編集 ｜ スキップ ｜ 納得した */}
      <View style={styles.actions} testID="keyword-actions">
        {editing ? (
          <>
            <ActionButton label="やめる" onPress={() => setEditing(false)} />
            <Divider />
            <ActionButton label="このキーワードにする" onPress={confirmEdit} emphasis />
          </>
        ) : (
          <>
            <ActionButton
              testID="keyword-action-edit"
              label={LABELS.edit}
              onPress={() => {
                setDraft(keywords.slice(0, MAX_KEYWORDS).map((k) => k.label));
                setEditing(true);
              }}
              disabled={busy}
            />
            <Divider />
            <ActionButton
              testID="keyword-action-skip"
              label={LABELS.skip}
              onPress={onSkip}
              disabled={busy}
            />
            <Divider />
            <ActionButton
              testID="keyword-action-accept"
              label={LABELS.accept}
              onPress={onAccept}
              emphasis
              disabled={busy}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ActionButton({
  label,
  onPress,
  emphasis = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Text style={[styles.actionLabel, emphasis && styles.actionLabelEmphasis]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassDim,
  },
  chipText: { fontFamily: fonts.sans, fontSize: 13, letterSpacing: 0.6, color: colors.brass },
  editList: { gap: spacing.sm },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.frameSoft,
    paddingBottom: spacing.xs,
  },
  hash: { color: colors.brassDim, fontFamily: fonts.sans, fontSize: 14 },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH - 8,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  remove: { color: colors.ivoryFaint, fontSize: 18, paddingHorizontal: spacing.xs },
  statusLine: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ivoryFaint,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  action: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, justifyContent: 'center' },
  actionPressed: { opacity: 0.6 },
  actionLabel: { fontFamily: fonts.sans, fontSize: 14, letterSpacing: 0.8, color: colors.ivoryDim },
  actionLabelEmphasis: { color: colors.brass },
  divider: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: colors.frame },
});
