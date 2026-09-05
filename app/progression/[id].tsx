import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { EMPTY_STATE, LABELS } from '@/constants/copy';
import { EVIDENCE_ROLE_JA } from '@/constants/progression';
import { phraseForMaturity } from '@/ai/progressionRules';
import { Screen } from '@components/ui/Screen';
import { TopBar } from '@components/ui/TopBar';
import { HairlineRule } from '@components/ui/HairlineRule';
import { useProgressionDetail, useProgressionVerdict } from '@/hooks/useProgressions';
import { formatShortDate } from '@/utils/period';

/**
 * One progression on its own screen (§21).
 *
 * The same content as the sheet on the map, reachable from anywhere that names
 * a progression — the mirror line after a save, a record's detail. It exists
 * so "「人に伝える」に新しい点が加わりました" is something the person can
 * follow, rather than a notice they can only read.
 */
export default function ProgressionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: detail } = useProgressionDetail(id ?? null);
  const verdict = useProgressionVerdict();

  const progression = detail?.progression;

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {progression ? (
          <>
            <Text style={styles.title}>{progression.title}</Text>
            <Text style={styles.maturity}>
              {phraseForMaturity(progression.maturity, progression.title)}
            </Text>

            {progression.summary ? (
              <Text style={styles.summary}>{progression.summary}</Text>
            ) : null}

            <HairlineRule />

            {detail && detail.steps.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{LABELS.path}</Text>
                {detail.steps.map((step, index) => (
                  <Pressable
                    key={step.logId}
                    onPress={() => router.push(`/log/${step.logId}`)}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatShortDate(step.occurredOn)} ${step.eventSummary}`}
                    style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                  >
                    {index > 0 ? <Text style={styles.arrow}>↓</Text> : null}
                    <Text style={styles.stepDate}>{formatShortDate(step.occurredOn)}</Text>
                    <Text style={styles.stepText}>{step.eventSummary}</Text>
                    <Text style={styles.stepRole}>{EVIDENCE_ROLE_JA[step.role]}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.dim}>{EMPTY_STATE.progressionDetail}</Text>
            )}

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

            <View style={styles.verdictRow}>
              <Pressable
                onPress={() =>
                  verdict.mutate({ progressionId: progression.id, verdict: 'accepted' })
                }
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={LABELS.accepted}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={
                    progression.verdict === 'accepted' ? styles.verdictActive : styles.verdict
                  }
                >
                  {LABELS.accepted}
                </Text>
              </Pressable>

              {/* Rewriting happens on the map sheet, where the canvas gives the
                  wording its context. Here it is only ever agreement. */}
              <Pressable
                onPress={() =>
                  verdict.mutate({ progressionId: progression.id, verdict: 'adjusted' })
                }
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={LABELS.adjusted}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={
                    progression.verdict === 'adjusted' ? styles.verdictActive : styles.verdict
                  }
                >
                  {LABELS.adjusted}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.dim}>この変化は見つかりませんでした。</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 36, color: colors.ivory },
  maturity: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryFaint },
  summary: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 26, color: colors.ivoryDim },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 3,
    color: colors.ivoryFaint,
  },
  step: { gap: 2 },
  pressed: { opacity: 0.6 },
  arrow: { fontFamily: fonts.sans, fontSize: 12, color: colors.frame },
  stepDate: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.4, color: colors.ivoryFaint },
  stepText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.ivory },
  stepRole: { fontFamily: fonts.sans, fontSize: 10, color: colors.brassDim },
  gain: { gap: 2 },
  gainLabel: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, color: colors.ivory },
  gainDescription: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.ivoryDim },
  dim: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.ivoryFaint },
  verdictRow: { flexDirection: 'row', gap: spacing.lg },
  verdict: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  verdictActive: { fontFamily: fonts.sans, fontSize: 13, color: colors.brass },
});
