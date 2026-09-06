import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, fonts } from '@/theme';
import { LABELS, TARGET_SHORT } from '@/constants/copy';
import { buildChangeMap } from '@/map/changeMap';
import type { Change } from '@/types';

interface RadialChangeMapProps {
  monthKey: string;
  changes: readonly Change[];
  /** The card in view, lit brighter than the rest. */
  selectedId?: string | null;
  width: number;
  height: number;
  /** One tap moves the page to this change's card (§24). */
  onSelect: (changeId: string) => void;
}

/**
 * ME at the centre, and what has changed around it (§18–§20).
 *
 * Every label is what moved — 「自分の基準で選ぶ」 — never what the writing was
 * about. A month with two changes draws two points and a month with none draws
 * ME alone, which is honest and is what most first months look like.
 *
 * The map is also the index for the cards below it (§24): tapping a point
 * takes the page to what that point means, because a picture nobody can read
 * back into words is decoration.
 */
export function RadialChangeMap({
  monthKey,
  changes,
  selectedId = null,
  width,
  height,
  onSelect,
}: RadialChangeMapProps) {
  const graph = useMemo(
    () =>
      buildChangeMap({
        monthKey,
        changes,
        targetLabels: TARGET_SHORT,
        selectedId,
        width,
        height,
      }),
    [monthKey, changes, selectedId, width, height]
  );

  return (
    <View style={[styles.wrap, { width, height }]} testID="radial-change-map">
      <Svg width={width} height={height}>
        {graph.edges.map((edge) => (
          <Line
            key={edge.id}
            x1={edge.fromX}
            y1={edge.fromY}
            x2={edge.toX}
            y2={edge.toY}
            stroke={colors.edge}
            strokeWidth={0.7}
          />
        ))}

        {graph.nodes.map((node) => (
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

      {/* What each arc of the sky answers to (§14). The kind only — the thing
          itself heads the group of cards, where there is room for it. Without
          this the five points read as five unrelated findings rather than as
          movement on what the person said they wanted. */}
      {graph.sectors.map((sector) =>
        sector.label ? (
          <View
            key={sector.key}
            pointerEvents="none"
            testID={`map-sector-${sector.targetType}`}
            style={[styles.sectorLabel, { left: sector.x - 44, top: sector.y - 7 }]}
          >
            <Text numberOfLines={1} style={styles.sector}>
              {sector.label}
            </Text>
          </View>
        ) : null
      )}

      {graph.nodes.map((node) => (
        <Pressable
          key={node.id}
          testID={`change-node-${node.id}`}
          onPress={() => onSelect(node.id)}
          accessibilityRole="button"
          accessibilityLabel={node.title}
          accessibilityHint="この変化の説明へ移動します"
          style={[styles.hit, { left: node.x - 60, top: node.y - 20 }]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              node.selected && styles.titleSelected,
              { opacity: Math.max(0.6, node.glow) },
            ]}
          >
            {node.title}
          </Text>
        </Pressable>
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
    width: 120,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.ivory,
  },
  titleSelected: { color: colors.brass },
  sectorLabel: { position: 'absolute', width: 88, alignItems: 'center' },
  sector: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: colors.brassDim,
  },
});
