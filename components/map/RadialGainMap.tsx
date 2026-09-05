import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { colors, fonts } from '@/theme';
import { GAIN_TYPE_LABEL } from '@/constants/gain';
import { LABELS } from '@/constants/copy';
import { buildGainGraph } from '@/map/gainGraph';
import { truncate } from '@/utils/text';
import type { MonthGain } from '@/data/repository';

interface RadialGainMapProps {
  monthKey: string;
  gains: readonly MonthGain[];
  width: number;
  height: number;
  expandedGainId: string | null;
  onGainPress: (gainId: string) => void;
  onEvidencePress: (logId: string) => void;
}

/**
 * ME at the centre, and what has grown from it (§14).
 *
 * In its resting state the picture is only ME, the gain nodes and the lines —
 * no counts, no percentages, no legend. Everything else waits behind a tap.
 * Labels are drawn as views rather than SVG text so they stay selectable by
 * screen readers and wrap the way the platform expects.
 */
export function RadialGainMap({
  monthKey,
  gains,
  width,
  height,
  expandedGainId,
  onGainPress,
  onEvidencePress,
}: RadialGainMapProps) {
  const graph = useMemo(
    () => buildGainGraph({ monthKey, gains, expandedGainId, width, height }),
    [monthKey, gains, expandedGainId, width, height]
  );

  // A very slight breathing light at the centre. Nothing else on this screen
  // moves; a particle field would turn a record into a toy.
  const breath = useSharedValue(0.5);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breath]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.22 + breath.value * 0.24 }));

  return (
    <View style={{ width, height }} testID="radial-gain-map">
      <Svg width={width} height={height}>
        <G>
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

          {graph.evidence.map((node) => (
            <Circle key={node.id} cx={node.x} cy={node.y} r={node.r} fill={colors.starDim} />
          ))}

          {graph.gains.map((node) => (
            <G key={node.id}>
              <Circle cx={node.x} cy={node.y} r={node.r} fill={colors.star} opacity={node.glow} />
              {node.isNew ? (
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 5}
                  fill="none"
                  stroke={colors.brassDim}
                  strokeWidth={0.6}
                />
              ) : null}
            </G>
          ))}

          <Circle cx={graph.me.x} cy={graph.me.y} r={graph.me.r} fill="none" stroke={colors.brass} strokeWidth={0.8} />
          <Circle cx={graph.me.x} cy={graph.me.y} r={2.2} fill={colors.brass} />
        </G>
      </Svg>

      <Animated.View
        style={[
          styles.halo,
          haloStyle,
          { left: graph.me.x - 30, top: graph.me.y - 30 },
        ]}
        pointerEvents="none"
      />

      <Text
        style={[styles.meLabel, { left: graph.me.x - 40, top: graph.me.y + graph.me.r + 6 }]}
        pointerEvents="none"
      >
        {LABELS.me}
      </Text>

      {graph.branches.map((branch) => (
        <Text
          key={branch.type}
          style={[styles.typePlate, { left: branch.x - 52, top: branch.y - 7 }]}
          pointerEvents="none"
          numberOfLines={1}
        >
          {GAIN_TYPE_LABEL[branch.type]}
        </Text>
      ))}

      {graph.gains.map((node) => (
        <Pressable
          key={`hit:${node.id}`}
          testID={`gain-node-${node.id}`}
          onPress={() => onGainPress(node.id)}
          accessibilityRole="button"
          accessibilityLabel={node.label}
          accessibilityHint="この Gain がどう生まれたかを開きます"
          accessibilityState={{ expanded: expandedGainId === node.id }}
          // The plaque hangs below its star, and the touch target reaches back
          // up over the star itself so the dot is tappable too.
          hitSlop={{ top: node.r + 16, bottom: 4, left: 4, right: 4 }}
          style={[styles.gainHit, { left: node.x - 54, top: node.y + node.r + 5 }]}
        >
          <Text
            style={[
              styles.gainLabel,
              expandedGainId === node.id && styles.gainLabelActive,
              node.hasVerdict && styles.gainLabelSettled,
            ]}
            numberOfLines={2}
          >
            {truncate(node.label, 10)}
          </Text>
        </Pressable>
      ))}

      {graph.evidence.map((node) => (
        <Pressable
          key={`hit:${node.id}`}
          testID={`evidence-node-${node.logId}`}
          onPress={() => onEvidencePress(node.logId)}
          accessibilityRole="button"
          accessibilityLabel="この Gain を支えている記録"
          style={[styles.evidenceHit, { left: node.x - 22, top: node.y - 22 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // A ring rather than a disc: a filled circle behind ME reads as a smudge,
  // and the brief is a faint breath of light, not a glow effect.
  halo: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassDim,
  },
  meLabel: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    fontFamily: fonts.serif,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.brass,
  },
  typePlate: {
    position: 'absolute',
    width: 104,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 8.5,
    letterSpacing: 2.2,
    color: colors.ivoryFaint,
  },
  gainHit: {
    position: 'absolute',
    width: 108,
    alignItems: 'center',
  },
  gainLabel: {
    fontFamily: fonts.serif,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.ivoryDim,
  },
  gainLabelActive: { color: colors.ivory },
  gainLabelSettled: { color: colors.ivory },
  evidenceHit: { position: 'absolute', width: 44, height: 44 },
});
