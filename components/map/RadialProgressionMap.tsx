import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, fonts } from '@/theme';
import { LABELS } from '@/constants/copy';
import { buildProgressionGraph } from '@/map/progressionGraph';
import type { MonthProgression } from '@/types';

interface RadialProgressionMapProps {
  monthKey: string;
  progressions: readonly MonthProgression[];
  expandedId: string | null;
  width: number;
  height: number;
  onSelect: (progressionId: string) => void;
  onSelectStep: (logId: string) => void;
}

/**
 * ME at the centre, and how the person has moved around it (§16, §17).
 *
 * What is drawn is not the records but the movement between them, so a month
 * with a lot of writing and nothing connected yet shows a quiet sky — which is
 * honest, and is the state most months start in.
 *
 * Every label on screen is the person's own vocabulary. No axis, no legend, no
 * count, no percentage, no bar: §19 rules those out, and without them the
 * picture reads as a chart of a life rather than an analysis of one.
 */
export function RadialProgressionMap({
  monthKey,
  progressions,
  expandedId,
  width,
  height,
  onSelect,
  onSelectStep,
}: RadialProgressionMapProps) {
  const graph = useMemo(
    () =>
      buildProgressionGraph({ monthKey, progressions, expandedId, width, height }),
    [monthKey, progressions, expandedId, width, height]
  );

  return (
    <View style={[styles.wrap, { width, height }]} testID="radial-progression-map">
      <Svg width={width} height={height}>
        {graph.edges.map((edge) => (
          <Line
            key={edge.id}
            x1={edge.fromX}
            y1={edge.fromY}
            x2={edge.toX}
            y2={edge.toY}
            stroke={edge.kind === 'branch' ? colors.edge : colors.edgeSemantic}
            strokeWidth={edge.kind === 'branch' ? 0.7 : 0.5}
          />
        ))}

        {graph.steps.map((step) => (
          <Circle
            key={step.id}
            cx={step.x}
            cy={step.y}
            r={step.r}
            fill={colors.starDim}
          />
        ))}

        {graph.progressions.map((node) => (
          <Circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill={colors.star}
            opacity={node.glow}
          />
        ))}

        <Circle cx={graph.me.x} cy={graph.me.y} r={graph.me.r} fill={colors.brass} />
      </Svg>

      {/* ME is drawn, then named. The word sits under the point, not on it. */}
      <View
        pointerEvents="none"
        style={[styles.meLabel, { left: graph.me.x - 40, top: graph.me.y + graph.me.r + 6 }]}
      >
        <Text style={styles.me}>{LABELS.me}</Text>
      </View>

      {graph.progressions.map((node) => (
        <Pressable
          key={node.id}
          testID={`progression-node-${node.id}`}
          onPress={() => onSelect(node.id)}
          accessibilityRole="button"
          accessibilityLabel={node.title}
          style={[styles.hit, { left: node.x - 56, top: node.y - 22 }]}
        >
          <View style={styles.labelBox}>
            <Text
              numberOfLines={2}
              style={[styles.title, { opacity: Math.max(0.5, node.glow) }]}
            >
              {node.title}
            </Text>
            {/* NEW is a fact about when, not a score. There is no counterpart
                label for the others, because "not new" is not information. */}
            {node.isNew ? <Text style={styles.new}>{LABELS.new}</Text> : null}

            {/* Under the point, and only on the one the month opens with. */}
            {node.summary ? (
              <Text numberOfLines={3} style={styles.summary}>
                {node.summary}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}

      {graph.steps.map((step) => (
        <Pressable
          key={`hit:${step.id}`}
          testID={`step-node-${step.logId}`}
          onPress={() => onSelectStep(step.logId)}
          accessibilityRole="button"
          accessibilityLabel="この点の記録をひらく"
          style={[styles.stepHit, { left: step.x - 16, top: step.y - 16 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  meLabel: { position: 'absolute', width: 80, alignItems: 'center' },
  me: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 3.2,
    color: colors.brassDim,
  },
  hit: {
    position: 'absolute',
    width: 112,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 26,
  },
  labelBox: { alignItems: 'center', gap: 2 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.ivory,
  },
  new: {
    fontFamily: fonts.sans,
    fontSize: 8,
    letterSpacing: 2.4,
    color: colors.brassDim,
  },
  summary: {
    fontFamily: fonts.sans,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.ivoryFaint,
  },
  stepHit: { position: 'absolute', width: 32, height: 32 },
});
