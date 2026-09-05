import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, spacing } from '@/theme';
import { HOME } from '@/constants/copy';
import { Level1Picker } from './Level1Picker';
import { MomentTagPicker } from './MomentTagPicker';
import type { LogType, MomentTag, NewLogInput } from '@/types';

interface DailyComposerProps {
  onSave: (input: NewLogInput) => void;
  /**
   * Asks for the one-line question once a door and a tag are chosen. Returns
   * null when there is nothing worth asking.
   */
  onNeedQuestion: (input: {
    logType: LogType;
    momentTags: MomentTag[];
  }) => Promise<string | null>;
  saving?: boolean;
}

/**
 * The whole input surface (§8, §14).
 *
 * Open the app, tap a door, tap what kind of moment it was, and ✓. The
 * question appears once there is something to ask about, and answering it is
 * optional — §14 is explicit that a record with no free text is a complete
 * record. Target: 5-15 seconds.
 *
 * The question is fetched but never waited on: the save button is live from
 * the moment a door and a tag exist, so a slow network cannot make the fast
 * path slow.
 */
export function DailyComposer({ onSave, onNeedQuestion, saving = false }: DailyComposerProps) {
  const [logType, setLogType] = useState<LogType | null>(null);
  const [momentTags, setMomentTags] = useState<MomentTag[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');

  // Which request is current. A slower earlier answer must not overwrite a
  // newer one when the person keeps tapping.
  const requestRef = useRef(0);

  useEffect(() => {
    if (!logType || momentTags.length === 0) {
      setQuestion(null);
      return;
    }
    const token = (requestRef.current += 1);
    let cancelled = false;
    void onNeedQuestion({ logType, momentTags }).then((next) => {
      if (cancelled || token !== requestRef.current) return;
      setQuestion(next);
    });
    return () => {
      cancelled = true;
    };
  }, [logType, momentTags, onNeedQuestion]);

  const canSave = logType !== null && momentTags.length > 0 && !saving;
  const started = logType !== null || momentTags.length > 0 || answer.length > 0;

  const reset = () => {
    setLogType(null);
    setMomentTags([]);
    setQuestion(null);
    setAnswer('');
  };

  const handleSave = () => {
    if (!logType || momentTags.length === 0 || saving) return;
    const trimmed = answer.trim();
    onSave({
      logType,
      momentTags,
      ...(question ? { aiQuestion: question } : {}),
      ...(trimmed ? { optionalAnswer: trimmed } : {}),
    });
    reset();
  };

  return (
    <View style={styles.wrap} testID="daily-composer">
      <Text style={styles.heading} accessibilityRole="header">
        {HOME.heading}
      </Text>

      <View style={styles.level}>
        <Text style={styles.levelLabel}>{HOME.level1}</Text>
        <Level1Picker value={logType} onChange={setLogType} />
      </View>

      <View style={styles.level}>
        <Text style={styles.levelLabel}>{HOME.level2}</Text>
        <MomentTagPicker value={momentTags} onChange={setMomentTags} />
      </View>

      {/* Level 3. Absent until there is something to ask about, and never a
          reason to wait — the save is already available above it. */}
      {question ? (
        <View style={styles.level} testID="level3">
          <Text style={styles.question}>{question}</Text>
          <TextInput
            testID="answer-input"
            value={answer}
            onChangeText={setAnswer}
            style={styles.input}
            placeholder={HOME.answerPlaceholder}
            placeholderTextColor={colors.ivoryFaint}
            accessibilityLabel={question}
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
  heading: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 32,
    color: colors.ivory,
    textAlign: 'center',
  },
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
