import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { antenna } from '@/constants/antennas';
import type { AntennaId, MonthInsight } from '@/types';

/**
 * The period's map: what it was watching at the centre, and what came out of
 * it around the edge.
 *
 * This draws the same 見立てカード that 現在地 shows, in a different posture —
 * one figure instead of a grid, so a finished period can be taken in at once.
 * It is not a second reading and nothing here generates anything: if a month
 * produced no cards, the map is empty, exactly as the band on 現在地 is.
 *
 * Four points at most, which is what a reading may produce anyway.
 */
export function PeriodMap({
  month,
  antennaIds,
  insights,
  onOpen,
}: {
  /** 1–12, or null for a year. */
  month: number | null;
  antennaIds: readonly AntennaId[];
  insights: MonthInsight[];
  onOpen: (insight: MonthInsight) => void;
}) {
  const points = insights.slice(0, 4);

  return (
    <View style={styles.panel} testID="period-map">
      <View style={styles.centre}>
        <Text style={styles.centreEyebrow}>
          {month === null ? COPY.setDirection : `${month}月の方向`}
        </Text>
        {antennaIds.length === 0 ? (
          <Text style={styles.centreText}>{COPY.placeMonth}</Text>
        ) : (
          antennaIds.map((id) => (
            <Text key={id} style={styles.centreText}>
              {antenna(id)?.title ?? id}
            </Text>
          ))
        )}
      </View>

      {points.length === 0 ? (
        <Text style={styles.none}>{COPY.insightEmpty}</Text>
      ) : (
        <View style={styles.points}>
          {points.map((insight) => (
            <Pressable
              key={insight.id}
              testID={`map-point-${insight.id}`}
              onPress={() => onOpen(insight)}
              accessibilityRole="button"
              accessibilityLabel={`${insight.label} ${insight.text}`}
              style={({ pressed }) => [styles.point, pressed && styles.pressed]}
            >
              {/* The line back to the centre, drawn rather than implied: the
                  figure is only a figure if you can see what holds it up. */}
              <Svg width={18} height={26} style={styles.stem}>
                <Line x1={9} y1={0} x2={9} y2={16} stroke={colors.hairline} strokeWidth={1} />
                <Circle cx={9} cy={20} r={4} fill={colors.paper} stroke={colors.brownDim} strokeWidth={1} />
              </Svg>
              <Text style={styles.pointLabel}>{insight.label}</Text>
              <Text style={styles.pointText}>{insight.text}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {points.length > 0 ? <Text style={styles.hint}>{COPY.mapHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.butter,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  centre: {
    backgroundColor: colors.brown,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  centreEyebrow: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.6, color: colors.butterSoft },
  centreText: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 24, color: colors.onBrown },
  points: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  point: { flexBasis: '44%', flexGrow: 1, alignItems: 'center', gap: 2 },
  stem: { marginBottom: 2 },
  pressed: { opacity: 0.7 },
  pointLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.orange, textAlign: 'center' },
  pointText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 20,
    color: colors.brown,
    textAlign: 'center',
  },
  none: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 21,
    color: colors.brownDim,
    textAlign: 'center',
  },
  hint: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
});
