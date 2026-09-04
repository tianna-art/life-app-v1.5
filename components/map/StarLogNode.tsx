import { Circle, G, Line, Polygon } from 'react-native-svg';
import { colors } from '@/theme';
import type { LogType } from '@/types';

interface StarLogNodeProps {
  x: number;
  y: number;
  type: LogType;
  radius: number;
  dimmed?: boolean;
}

/**
 * A single log, drawn as a star. 出来事 and つぶやき differ in shape and glow —
 * shape carries the distinction, so the meaning does not rely on color alone.
 */
export function StarLogNode({ x, y, type, radius, dimmed = false }: StarLogNodeProps) {
  const opacity = dimmed ? 0.28 : 1;

  if (type === 'event') {
    // 出来事: a compact four-point star — a fixed point of fact.
    const points = [
      `0,${-radius * 1.8}`,
      `${radius * 0.5},${-radius * 0.5}`,
      `${radius * 1.8},0`,
      `${radius * 0.5},${radius * 0.5}`,
      `0,${radius * 1.8}`,
      `${-radius * 0.5},${radius * 0.5}`,
      `${-radius * 1.8},0`,
      `${-radius * 0.5},${-radius * 0.5}`,
    ].join(' ');
    return (
      <G x={x} y={y} opacity={opacity}>
        <Polygon points={points} fill={colors.star} opacity={0.92} />
      </G>
    );
  }

  // つぶやき: a soft halo with a faint cross-glow — diffuse, atmospheric.
  return (
    <G x={x} y={y} opacity={opacity}>
      <Circle r={radius * 2.4} fill={colors.star} opacity={0.08} />
      <Circle r={radius} fill={colors.star} opacity={0.7} />
      <Line x1={-radius * 2} y1={0} x2={radius * 2} y2={0} stroke={colors.starDim} strokeWidth={0.5} />
      <Line x1={0} y1={-radius * 2} x2={0} y2={radius * 2} stroke={colors.starDim} strokeWidth={0.5} />
    </G>
  );
}
