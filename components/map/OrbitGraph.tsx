import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { MIN_TOUCH, colors, fonts } from '@/theme';
import type { Category, LogWithAnalysis } from '@/types';
import { buildGraph, type GraphNode } from '@/map/graph';
import { CelestialGlyph, glyphForKey } from './CelestialGlyphs';
import { StarLogNode } from './StarLogNode';

interface OrbitGraphProps {
  periodKey: string;
  width: number;
  height: number;
  categories: Category[];
  /** Logs of THIS period only. The caller never mixes periods. */
  logs: LogWithAnalysis[];
  expanded: ReadonlySet<string>;
  onCategoryPress: (categoryId: string) => void;
  onLogPress: (logId: string) => void;
}

const CATEGORY_HIT = 64;
const LOG_HIT = MIN_TOUCH;

/**
 * 自分 を中心に、カテゴリーが放射状にのび、開いたカテゴリーの先に記録が並ぶ図.
 *
 * The SVG is pure paint and every touch target is a real Pressable on top:
 * react-native-svg's web build renders `<G onPress>` with no layout box, so an
 * SVG-level handler is silently dead in a browser.
 */
export function OrbitGraph({
  periodKey,
  width,
  height,
  categories,
  logs,
  expanded,
  onCategoryPress,
  onLogPress,
}: OrbitGraphProps) {
  const graph = useMemo(
    () => buildGraph({ periodKey, categories, logs, expanded, width, height }),
    [periodKey, categories, logs, expanded, width, height]
  );

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const dust = useMemo(() => buildDust(periodKey, width, height), [periodKey, width, height]);

  const categoryNodes = graph.nodes.filter((n) => n.kind === 'category');
  const logNodes = graph.nodes.filter((n) => n.kind === 'log');
  const self = byId.get('self');

  return (
    <View style={[styles.wrap, { width, height }]} testID="orbit-graph">
      <Svg width={width} height={height} pointerEvents="none">
        {dust.map((d, i) => (
          <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={colors.star} opacity={d.o} />
        ))}

        {graph.edges.map((edge) => {
          const a = byId.get(edge.from);
          const b = byId.get(edge.to);
          if (!a || !b) return null;
          const semantic = edge.kind === 'semantic';
          return (
            <Line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={semantic ? colors.edgeSemantic : colors.edge}
              strokeWidth={semantic ? 0.7 : 0.6}
              strokeDasharray={semantic ? '3 5' : undefined}
            />
          );
        })}

        {/* 自分 */}
        {self ? (
          <G x={self.x} y={self.y}>
            <Circle r={self.r * 2.1} fill={colors.brass} opacity={0.05} />
            <Circle r={self.r} fill="none" stroke={colors.brassDim} strokeWidth={0.9} />
            <Circle r={3} fill={colors.star} opacity={0.9} />
            <SvgText
              y={self.r + 18}
              fill={colors.ivoryDim}
              fontSize={11}
              fontFamily={fonts.serif}
              textAnchor="middle"
            >
              わたし
            </SvgText>
          </G>
        ) : null}

        {logNodes.map((node) => (
          <StarLogNode
            key={node.id}
            x={node.x}
            y={node.y}
            type={node.logType ?? 'event'}
            radius={node.r * 0.7}
          />
        ))}

        {categoryNodes.map((node) => {
          const open = node.categoryId ? expanded.has(node.categoryId) : false;
          return (
            <G key={node.id} x={node.x} y={node.y}>
              <Circle r={node.r * 1.6} fill={colors.brass} opacity={open ? 0.09 : 0.05} />
              <CelestialGlyph
                kind={glyphForKey(node.categoryId ?? node.label)}
                size={node.r * 2}
                emphasis={node.weight}
                active={open}
              />
              {/* 閉じているときだけ、先があることを細い環で示す */}
              {!open && node.childCount > 0 ? (
                <Circle
                  r={node.r + 7}
                  fill="none"
                  stroke={colors.brassDim}
                  strokeWidth={0.5}
                  strokeDasharray="1.5 4"
                  opacity={0.7}
                />
              ) : null}
              <SvgText
                y={node.r + 19}
                fill={open ? colors.ivory : colors.ivoryDim}
                fontSize={12}
                fontFamily={fonts.serif}
                textAnchor="middle"
              >
                {node.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {logNodes.map((node) => (
          <Pressable
            key={`hit-${node.id}`}
            testID={`orbit-log-${node.logId}`}
            onPress={() => node.logId && onLogPress(node.logId)}
            accessibilityRole="button"
            accessibilityLabel={`${node.logType === 'event' ? '出来事' : 'つぶやき'}の記録`}
            accessibilityHint="この記録の詳細を開きます"
            style={({ pressed }) => [
              styles.hit,
              hitBox(node, LOG_HIT),
              pressed && styles.hitPressed,
            ]}
          />
        ))}

        {categoryNodes.map((node) => {
          const open = node.categoryId ? expanded.has(node.categoryId) : false;
          return (
            <Pressable
              key={`hit-${node.id}`}
              testID={`orbit-category-${node.categoryId}`}
              onPress={() => node.categoryId && onCategoryPress(node.categoryId)}
              accessibilityRole="button"
              accessibilityLabel={node.label}
              accessibilityState={{ expanded: open }}
              accessibilityHint="この引き出しを開いて、まとめを読みます"
              style={({ pressed }) => [
                styles.hit,
                hitBox(node, CATEGORY_HIT),
                { borderRadius: CATEGORY_HIT / 2 },
                pressed && styles.hitPressed,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function hitBox(node: GraphNode, size: number) {
  return { left: node.x - size / 2, top: node.y - size / 2, width: size, height: size };
}

function buildDust(seed: string, width: number, height: number) {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  const rng = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
  return Array.from({ length: 44 }, () => ({
    x: rng() * width,
    y: rng() * height,
    r: 0.4 + rng() * 1,
    o: 0.07 + rng() * 0.18,
  }));
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  hit: { position: 'absolute' },
  hitPressed: { backgroundColor: colors.brassFaint, borderRadius: 999 },
});
