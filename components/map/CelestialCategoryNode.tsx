import { Circle, G, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/theme';
import { CelestialGlyph, glyphForKey } from './CelestialGlyphs';

interface CelestialCategoryNodeProps {
  x: number;
  y: number;
  name: string;
  categoryId: string;
  radius: number;
  weight: number;
}

/**
 * A category, drawn as a celestial figure with its name on a plaque line.
 *
 * Drawing only — the press target is a real Pressable overlaid by
 * ConstellationMap. react-native-svg's web build renders `<G onPress>` as a
 * zero-size element, so an SVG-level handler is silently dead in a browser.
 */
export function CelestialCategoryNode({
  x,
  y,
  name,
  categoryId,
  radius,
  weight,
}: CelestialCategoryNodeProps) {
  return (
    <G x={x} y={y}>
      <Circle r={radius * 1.5} fill={colors.brass} opacity={0.05} />
      <CelestialGlyph kind={glyphForKey(categoryId || name)} size={radius * 2} emphasis={weight} />
      <SvgText
        y={radius + 20}
        fill={colors.ivory}
        fontSize={13}
        fontFamily={fonts.serif}
        textAnchor="middle"
      >
        {name}
      </SvgText>
    </G>
  );
}
