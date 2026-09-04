import Svg, { G } from 'react-native-svg';
import { View } from 'react-native';
import { CelestialGlyph } from '@components/map/CelestialGlyphs';
import type { CategoryIcon } from '@/constants/icons';

/**
 * One category mark, standing on its own in ordinary layout — a chip, a
 * settings row, the picker. The MAP draws the same glyph directly into its own
 * canvas; this is the wrapper for everywhere else.
 *
 * It is paint, never a target: whatever surrounds it owns the touch.
 */
export function CategoryMark({
  icon,
  size = 18,
  active = false,
}: {
  icon: CategoryIcon;
  size?: number;
  active?: boolean;
}) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} pointerEvents="none">
        <G x={size / 2} y={size / 2}>
          <CelestialGlyph kind={icon} size={size * 0.86} active={active} />
        </G>
      </Svg>
    </View>
  );
}
