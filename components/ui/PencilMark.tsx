import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * The pencil.
 *
 * It marks the one place on a card that can still be filled in, and it is the
 * counterpart of the 「›」 on a card that already has something: a chevron says
 * "there is more of this to look at", a pencil says "this is yours to write".
 * Showing both, or the wrong one, is how a card that is waiting for you comes
 * to look like a card that is finished.
 */
export function PencilMark({ size = 13, color = colors.orange }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="-9 -9 18 18">
      <Path
        d="M -6 6 L -5.4 2.6 L 2.6 -5.4 L 5.4 -2.6 L -2.6 5.4 Z M 2.6 -5.4 L 4.2 -7 C 5 -7.8 6.2 -7.8 7 -7 C 7.8 -6.2 7.8 -5 7 -4.2 L 5.4 -2.6"
        fill="none"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
