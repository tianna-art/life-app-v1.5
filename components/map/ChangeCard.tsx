import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { CHANGE, LABELS } from '@/constants/copy';
import { GAIN_CATEGORY_JA } from '@/constants/progression';
import { EVIDENCE_SHOWN } from '@/ai/changeRules';
import { formatShortDate } from '@/utils/period';
import { HairlineRule } from '@components/ui/HairlineRule';
import type { Change, ProgressionVerdict } from '@/types';

interface ChangeCardProps {
  change: Change;
  /** Lit while the person is looking at it, after tapping its point (§24). */
  focused: boolean;
  onOpenLog: (logId: string) => void;
  onOpenAllEvidence: (logIds: readonly string[]) => void;
  onVerdict: (verdict: ProgressionVerdict) => void;
}

/**
 * One change, in the order §27 fixes and never in another (§26).
 *
 *   TITLE                    the same string the map prints
 *   記録から                  two or three of the person's own records
 *   見えてきたこと            what those records show
 *   ありたい姿とのつながり     what that has to do with what they put down
 *
 * The order is the argument. Reading the interpretation first and the evidence
 * afterwards makes the evidence look selected to fit; reading the records
 * first means the person can disagree with the reading before it has told them
 * what to think, which is the only way "確かに、この記録があるなら" is
 * available to them at all.
 *
 * So the blocks are laid out here rather than left to a caller. There is no
 * prop that reorders them and no branch that omits the records.
 */
export function ChangeCard({
  change,
  focused,
  onOpenLog,
  onOpenAllEvidence,
  onVerdict,
}: ChangeCardProps) {
  const shown = change.evidence.slice(0, EVIDENCE_SHOWN);
  const rest = change.evidence.length - shown.length;

  return (
    <View
      testID={`change-card-${change.id}`}
      style={[styles.card, focused && styles.focused]}
    >
      <Text style={styles.title}>{change.title}</Text>

      {/* §27: the person's own words, before anything is said about them. */}
      <View style={styles.block}>
        <Text style={styles.section}>{CHANGE.fromRecords}</Text>
        {shown.map((entry) => (
          <Pressable
            key={entry.logId}
            testID={`change-evidence-${entry.logId}`}
            onPress={() => onOpenLog(entry.logId)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`${formatShortDate(entry.occurredOn)} ${entry.text}`}
            style={({ pressed }) => [styles.evidence, pressed && styles.pressed]}
          >
            <Text style={styles.date}>{formatShortDate(entry.occurredOn)}</Text>
            <Text style={styles.quote}>{entry.text}</Text>
          </Pressable>
        ))}
        {rest > 0 ? (
          <Pressable
            testID={`change-evidence-all-${change.id}`}
            onPress={() => onOpenAllEvidence(change.evidence.map((e) => e.logId))}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={CHANGE.allEvidence}
            style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          >
            <Text style={styles.moreLabel}>{CHANGE.allEvidence}</Text>
            <Text style={styles.moreCount}>{change.evidence.length}件</Text>
          </Pressable>
        ) : null}
      </View>

      {/* §16: only ever printed when a record from before said where they
          were. There is no fallback sentence and no inferred past. */}
      {change.beforeState ? (
        <View style={styles.block}>
          <Text style={styles.section}>{CHANGE.before}</Text>
          <Text style={styles.body}>{change.beforeState}</Text>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.section}>{CHANGE.observation}</Text>
        <Text style={styles.body}>{change.observation}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.section}>{CHANGE.targetConnection}</Text>
        {/* The thing they put down, named. Without it the sentence below is
            an opinion about the person rather than a link to their own words. */}
        {change.linkedTargetLabel ? (
          <Text style={styles.target}>「{change.linkedTargetLabel}」</Text>
        ) : null}
        <Text style={styles.body}>{change.targetConnection}</Text>
      </View>

      {/* Only when something has actually settled (§32, §33). Most changes
          never reach this and the section is simply absent. */}
      {change.gains.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>{LABELS.whatYouGained}</Text>
          {change.gains.map((gain) => (
            <View key={gain.id} style={styles.gain}>
              <Text style={styles.gainCategory}>{GAIN_CATEGORY_JA[gain.category]}</Text>
              <Text style={styles.gainLabel}>{gain.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <HairlineRule />

      <View style={styles.verdictRow}>
        <Pressable
          testID={`change-accepted-${change.id}`}
          onPress={() => onVerdict('accepted')}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LABELS.accepted}
          style={({ pressed }) => [styles.verdictButton, pressed && styles.pressed]}
        >
          <Text style={change.verdict === 'accepted' ? styles.verdictActive : styles.verdict}>
            {LABELS.accepted}
          </Text>
        </Pressable>
        <Pressable
          testID={`change-adjusted-${change.id}`}
          onPress={() => onVerdict('adjusted')}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LABELS.adjusted}
          style={({ pressed }) => [styles.verdictButton, pressed && styles.pressed]}
        >
          <Text style={change.verdict === 'adjusted' ? styles.verdictActive : styles.verdict}>
            {LABELS.adjusted}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // Where the map sent you. Brass rather than a highlight fill: the card is
  // being pointed at, not selected.
  focused: { borderColor: colors.brassDim },
  title: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 31, color: colors.ivory },
  block: { gap: spacing.xs },
  // Japanese, so not the English eyebrow's metrics. Kana at 9px under 3px of
  // tracking is a texture rather than a word.
  section: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.6,
    lineHeight: 18,
    color: colors.ivoryFaint,
  },
  evidence: { gap: 1, paddingVertical: 3 },
  pressed: { opacity: 0.6 },
  date: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.4, color: colors.brassDim },
  quote: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 23, color: colors.ivory },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 25, color: colors.ivoryDim },
  target: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 25, color: colors.ivory },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH },
  moreLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.brass },
  moreCount: { fontFamily: fonts.sans, fontSize: 11, color: colors.ivoryFaint },
  gain: { gap: 1 },
  gainCategory: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.6, color: colors.brassDim },
  gainLabel: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, color: colors.ivory },
  verdictRow: { flexDirection: 'row', gap: spacing.lg },
  verdictButton: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  verdict: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  verdictActive: { fontFamily: fonts.sans, fontSize: 13, color: colors.brass },
});
