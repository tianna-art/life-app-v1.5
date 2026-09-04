import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { MIN_TOUCH, colors, fonts } from '@/theme';
import type { Category, LogWithAnalysis } from '@/types';
import { buildMonthlyLayout, buildYearlyLayout } from '@/map/layout';
import { CelestialCategoryNode } from './CelestialCategoryNode';
import { StarLogNode } from './StarLogNode';

interface ConstellationMapProps {
  mode: 'month' | 'year';
  periodKey: string;
  width: number;
  height: number;
  categories: Category[];
  /** Logs of THIS period only. The caller never mixes periods. */
  logs: LogWithAnalysis[];
  onCategoryPress: (categoryId: string) => void;
  onLogPress?: (logId: string) => void;
  openedLogIds?: Set<string>;
}

const CATEGORY_HIT = 68;
const LOG_HIT = MIN_TOUCH;

/**
 * The sky for exactly one period. Nothing here is a score: no numbers, no
 * percentages, no ranking is rendered.
 *
 * The SVG is pure paint; every touch target is a real Pressable positioned on
 * top of it, so taps behave identically on iOS, Android and web.
 */
export function ConstellationMap({
  mode,
  periodKey,
  width,
  height,
  categories,
  logs,
  onCategoryPress,
  onLogPress,
  openedLogIds,
}: ConstellationMapProps) {
  const layout = useMemo(() => {
    const base = { periodKey, width, height, categories, logs };
    return mode === 'month'
      ? buildMonthlyLayout(base)
      : buildYearlyLayout({ ...base, ...(openedLogIds ? { openedLogIds } : {}) });
  }, [mode, periodKey, width, height, categories, logs, openedLogIds]);

  return (
    <View style={[styles.wrap, { width, height }]} testID="constellation-map">
      <Svg width={width} height={height} pointerEvents="none">
        {/* Star dust: atmosphere only. */}
        {layout.dust.map((d, i) => (
          <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={colors.star} opacity={d.o} />
        ))}

        {layout.edges.map((edge) => (
          <Line
            key={edge.key}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke={edge.variant === 'semantic' ? colors.edgeSemantic : colors.edge}
            strokeWidth={edge.variant === 'semantic' ? 0.7 : 0.5}
            strokeDasharray={edge.variant === 'semantic' ? '3 5' : undefined}
          />
        ))}

        {layout.monthNodes.map((node) => (
          <G key={`${node.categoryId}-${node.monthKey}`} x={node.x} y={node.y}>
            <Circle r={node.radius} fill="none" stroke={colors.brassDim} strokeWidth={0.7} />
            <SvgText
              y={4}
              fill={colors.ivoryDim}
              fontSize={10}
              fontFamily={fonts.sans}
              textAnchor="middle"
            >
              {node.label}
            </SvgText>
          </G>
        ))}

        {layout.logNodes.map((node) => (
          <StarLogNode
            key={node.logId}
            x={node.x}
            y={node.y}
            type={node.type}
            radius={node.radius}
          />
        ))}

        {layout.categoryNodes.map((node) => (
          <CelestialCategoryNode
            key={node.categoryId}
            x={node.x}
            y={node.y}
            name={node.name}
            categoryId={node.categoryId}
            radius={node.radius}
            weight={node.weight}
          />
        ))}
      </Svg>

      {/* Touch layer. Logs first so a category glyph always wins an overlap. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {onLogPress
          ? layout.logNodes.map((node) => (
              <Pressable
                key={`hit-${node.logId}`}
                testID={`map-log-${node.logId}`}
                onPress={() => onLogPress(node.logId)}
                accessibilityRole="button"
                accessibilityLabel={node.type === 'event' ? '出来事の記録' : 'つぶやきの記録'}
                accessibilityHint="この記録の詳細を開きます"
                style={({ pressed }) => [
                  styles.hit,
                  {
                    left: node.x - LOG_HIT / 2,
                    top: node.y - LOG_HIT / 2,
                    width: LOG_HIT,
                    height: LOG_HIT,
                  },
                  pressed && styles.hitPressed,
                ]}
              />
            ))
          : null}

        {layout.categoryNodes.map((node) => (
          <Pressable
            key={`hit-${node.categoryId}`}
            testID={`map-category-${node.categoryId}`}
            onPress={() => onCategoryPress(node.categoryId)}
            accessibilityRole="button"
            accessibilityLabel={`${node.name} のカテゴリー`}
            accessibilityHint="この期間のインサイトと関連ログを開きます"
            style={({ pressed }) => [
              styles.hit,
              {
                left: node.x - CATEGORY_HIT / 2,
                top: node.y - CATEGORY_HIT / 2,
                width: CATEGORY_HIT,
                height: CATEGORY_HIT,
                borderRadius: CATEGORY_HIT / 2,
              },
              pressed && styles.hitPressed,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  hit: { position: 'absolute' },
  hitPressed: { backgroundColor: colors.brassFaint, borderRadius: 999 },
});
