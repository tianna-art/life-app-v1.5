import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, fonts } from '@/theme';
import { LABELS } from '@/constants/copy';
import { buildProgressionGraph } from '@/map/progressionGraph';
import type { ProgressionNode, StepNode } from '@/map/progressionGraph';
import { useDoubleTap } from './useDoubleTap';
import type { MonthMap, MonthProgression, ProgressionPattern } from '@/types';

interface RadialProgressionMapProps {
  monthKey: string;
  progressions: readonly MonthProgression[];
  expandedId: string | null;
  /** The month's brief: which point opens it, and the sentence underneath. */
  lead?: MonthMap | null;
  /** Patterns the person's cards made worth watching (§19). */
  watched?: readonly ProgressionPattern[];
  width: number;
  height: number;
  /** One tap: open or close what is under this point. */
  onToggle: (progressionId: string) => void;
  /** Two taps: what this point is. */
  onOpenPoint: (progressionId: string) => void;
  /** Two taps on a branch: the records it was read from. */
  onOpenBranch: (logIds: readonly string[], label: string) => void;
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
  lead = null,
  watched,
  width,
  height,
  onToggle,
  onOpenPoint,
  onOpenBranch,
}: RadialProgressionMapProps) {
  const graph = useMemo(
    () =>
      buildProgressionGraph({
        monthKey,
        progressions,
        expandedId,
        lead,
        ...(watched ? { watched } : {}),
        width,
        height,
      }),
    [monthKey, progressions, expandedId, lead, watched, width, height]
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
        <PointHit
          key={node.id}
          node={node}
          onToggle={onToggle}
          onOpen={onOpenPoint}
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
          </View>
        </PointHit>
      ))}

      {graph.steps.map((step) => (
        <BranchHit key={step.id} step={step} onOpen={onOpenBranch} />
      ))}
    </View>
  );
}

/**
 * A point. One tap opens or closes what is under it; two say what it is.
 *
 * The two are different questions — "what happened here" and "what is this" —
 * and putting them on the same control keeps the sky from needing a second
 * one beside every node.
 */
function PointHit({
  node,
  onToggle,
  onOpen,
  children,
}: {
  node: ProgressionNode;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  const onPress = useDoubleTap(
    () => onToggle(node.id),
    () => onOpen(node.id)
  );

  return (
    <Pressable
      testID={`progression-node-${node.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={node.title}
      accessibilityHint="1回で中を開き、2回でこの点をひらきます"
      style={[styles.hit, { left: node.x - 56, top: node.y - 22 }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * A branch: what happened under a point, and the records it was read from.
 *
 * Its own words and one line under them. Two taps show the records — the
 * reading is a hypothesis and has to stay checkable against what was
 * actually written.
 */
function BranchHit({
  step,
  onOpen,
}: {
  step: StepNode;
  onOpen: (logIds: readonly string[], label: string) => void;
}) {
  const onPress = useDoubleTap(
    () => undefined,
    () => onOpen(step.logIds, step.label)
  );

  return (
    <Pressable
      testID={`branch-node-${step.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${step.label} ${step.summary}`}
      accessibilityHint="2回タップすると、もとになった記録が出ます"
      style={[styles.branchHit, { left: step.x - 60, top: step.y + step.r + 4 }]}
    >
      <Text numberOfLines={2} style={styles.branchLabel}>
        {step.label}
      </Text>
      {step.summary ? (
        <Text numberOfLines={2} style={styles.branchSummary}>
          {step.summary}
        </Text>
      ) : null}
    </Pressable>
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
  branchHit: { position: 'absolute', width: 120, alignItems: 'center', gap: 1 },
  branchLabel: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.ivoryDim,
  },
  branchSummary: {
    fontFamily: fonts.sans,
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
    color: colors.ivoryFaint,
  },
});
