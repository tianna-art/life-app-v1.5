import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '@/theme';
import type { LogType } from '@/types';

interface CategoryIconProps {
  logType: LogType;
  size?: number;
  color?: string;
}

/**
 * A mark for each of the three doors (§9).
 *
 * Drawn in the same vocabulary as MAP — points and the lines between them —
 * because that is what a record becomes there. Each says what the door is
 * without saying anything about the record:
 *
 *   自分の行動   a point with a line leaving it — something moved
 *   人との関わり  two points with a line between them
 *   つぶやき     an open point — there, and not yet solid
 *
 * All three are drawn at the same weight in the same colour. None of the
 * doors is the main one (§9), so none of them may look like it.
 */
export function CategoryIcon({ logType, size = 14, color = colors.brassDim }: CategoryIconProps) {
  const common = { stroke: color, strokeWidth: 1, strokeLinecap: 'round' as const };

  return (
    <Svg width={size} height={size} viewBox="-8 -8 16 16" accessibilityRole="image">
      {logType === 'self_action' ? (
        <>
          <Circle cx={-4} cy={0} r={2} fill={color} />
          <Line x1={-1} y1={0} x2={6} y2={0} {...common} />
        </>
      ) : null}

      {logType === 'relationship' ? (
        <>
          <Circle cx={-4.5} cy={0} r={2} fill={color} />
          <Line x1={-1.8} y1={0} x2={1.8} y2={0} {...common} />
          <Circle cx={4.5} cy={0} r={2} fill={color} />
        </>
      ) : null}

      {logType === 'thought' ? (
        <Circle cx={0} cy={0} r={4} fill="none" {...common} />
      ) : null}
    </Svg>
  );
}
