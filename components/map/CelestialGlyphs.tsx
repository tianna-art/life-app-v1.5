import { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { colors } from '@/theme';
import { CATEGORY_ICONS, fallbackIcon, type CategoryIcon } from '@/constants/icons';

/**
 * Category marks. Explicitly NOT plain circles: each is an abstraction of an
 * antique celestial atlas figure.
 *
 * The vocabulary itself lives in `@/constants/icons` because it is stored in
 * the database; this file only knows how to draw it.
 */
export type GlyphKind = CategoryIcon;

export const GLYPH_KINDS: readonly GlyphKind[] = CATEGORY_ICONS;

/** The mark for a category that carries none of its own. */
export const glyphForKey = fallbackIcon;

interface GlyphProps {
  kind: GlyphKind;
  size: number;
  /** 0..1 — drives ornament density only, never shown as a value. */
  emphasis?: number;
  active?: boolean;
}

export function CelestialGlyph({ kind, size, emphasis = 0.5, active = false }: GlyphProps) {
  const r = size / 2;
  const stroke = active ? colors.brass : colors.brassDim;
  const light = active ? colors.star : colors.starDim;

  switch (kind) {
    case 'sun': {
      const rays = 12;
      return (
        <G>
          <Circle r={r * 0.52} fill="none" stroke={stroke} strokeWidth={1} />
          <Circle r={r * 0.16} fill={light} opacity={0.8} />
          {Array.from({ length: rays }, (_, i) => {
            const a = (i / rays) * Math.PI * 2;
            const inner = r * 0.62;
            const outer = r * (i % 2 === 0 ? 1 : 0.82);
            return (
              <Line
                key={i}
                x1={Math.cos(a) * inner}
                y1={Math.sin(a) * inner}
                x2={Math.cos(a) * outer}
                y2={Math.sin(a) * outer}
                stroke={stroke}
                strokeWidth={0.8}
              />
            );
          })}
        </G>
      );
    }
    case 'ringed':
      return (
        <G>
          <Ellipse
            rx={r}
            ry={r * 0.34}
            fill="none"
            stroke={stroke}
            strokeWidth={0.9}
            transform="rotate(-18)"
          />
          <Circle r={r * 0.5} fill={colors.night} stroke={stroke} strokeWidth={1} />
          <Circle cx={-r * 0.16} cy={-r * 0.14} r={r * 0.1} fill={light} opacity={0.55} />
        </G>
      );
    case 'starburst': {
      const points: string[] = [];
      const spikes = 8;
      for (let i = 0; i < spikes * 2; i += 1) {
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.34;
        points.push(`${Math.cos(a) * rad},${Math.sin(a) * rad}`);
      }
      return (
        <G>
          <Polygon points={points.join(' ')} fill="none" stroke={stroke} strokeWidth={0.9} />
          <Circle r={r * 0.14} fill={light} opacity={0.85} />
        </G>
      );
    }
    case 'crescent':
      return (
        <G>
          <Path
            d={`M 0 ${-r} A ${r} ${r} 0 1 0 0 ${r} A ${r * 0.68} ${r} 0 1 1 0 ${-r} Z`}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
          />
          <Circle cx={r * 0.52} cy={-r * 0.5} r={1.6} fill={light} />
        </G>
      );
    case 'comet':
      return (
        <G>
          <Circle cx={r * 0.34} cy={-r * 0.28} r={r * 0.26} fill="none" stroke={stroke} strokeWidth={1} />
          <Path
            d={`M ${r * 0.12} ${-r * 0.1} Q ${-r * 0.4} ${r * 0.3} ${-r} ${r * 0.72}`}
            fill="none"
            stroke={stroke}
            strokeWidth={0.8}
            opacity={0.75}
          />
          <Path
            d={`M ${r * 0.3} ${r * 0.06} Q ${-r * 0.2} ${r * 0.5} ${-r * 0.72} ${r * 0.9}`}
            fill="none"
            stroke={stroke}
            strokeWidth={0.6}
            opacity={0.45}
          />
        </G>
      );
    case 'constellation': {
      // Five stars and the lines an atlas would draw between them.
      const stars = [
        [-0.72, -0.34],
        [-0.14, -0.78],
        [0.36, -0.16],
        [0.74, 0.46],
        [-0.32, 0.62],
      ] as const;
      return (
        <G>
          {stars.slice(1).map((point, i) => {
            const prev = stars[i] ?? point;
            return (
              <Line
                key={i}
                x1={prev[0] * r}
                y1={prev[1] * r}
                x2={point[0] * r}
                y2={point[1] * r}
                stroke={stroke}
                strokeWidth={0.7}
                opacity={0.8}
              />
            );
          })}
          {stars.map((point, i) => (
            <Circle
              key={`s${i}`}
              cx={point[0] * r}
              cy={point[1] * r}
              r={i === 2 ? r * 0.16 : r * 0.1}
              fill={light}
              opacity={0.9}
            />
          ))}
        </G>
      );
    }
    case 'compass': {
      // A compass rose: four long points, four short.
      const long: string[] = [];
      const short: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const reach = i % 2 === 0 ? r : r * 0.6;
        const target = i % 2 === 0 ? long : short;
        target.push(
          `M 0 0 L ${Math.cos(a - 0.16) * reach * 0.34} ${Math.sin(a - 0.16) * reach * 0.34} ` +
            `L ${Math.cos(a) * reach} ${Math.sin(a) * reach} ` +
            `L ${Math.cos(a + 0.16) * reach * 0.34} ${Math.sin(a + 0.16) * reach * 0.34} Z`
        );
      }
      return (
        <G>
          {/* At 22px a hairline ring simply does not render; these weights are
              what keep the rose legible beside a line of type. */}
          <Circle r={r * 0.94} fill="none" stroke={stroke} strokeWidth={0.7} opacity={0.6} />
          <Path d={short.join(' ')} fill="none" stroke={stroke} strokeWidth={0.7} opacity={0.85} />
          <Path d={long.join(' ')} fill="none" stroke={stroke} strokeWidth={0.9} />
          <Circle r={r * 0.1} fill={light} opacity={0.85} />
        </G>
      );
    }
    case 'spiral': {
      // A drawn-out spiral — the mark for what has not settled yet.
      const turns = 2.4;
      const steps = 48;
      let d = '';
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const a = t * turns * Math.PI * 2;
        const rad = t * r;
        d += `${i === 0 ? 'M' : 'L'} ${Math.cos(a) * rad} ${Math.sin(a) * rad} `;
      }
      return (
        <G>
          <Path d={d} fill="none" stroke={stroke} strokeWidth={0.8} opacity={0.9} />
          <Circle r={r * 0.12} fill={light} opacity={0.7} />
        </G>
      );
    }
    case 'phases': {
      // Three discs, waxing left to right.
      const discs = [-0.62, 0, 0.62] as const;
      return (
        <G>
          {discs.map((offset, i) => (
            <Circle
              key={i}
              cx={offset * r}
              cy={0}
              r={r * 0.3}
              fill={i === 2 ? light : 'none'}
              opacity={i === 2 ? 0.75 : 1}
              stroke={stroke}
              strokeWidth={0.9}
            />
          ))}
          <Path
            d={`M ${-0.32 * r} ${-r * 0.3} A ${r * 0.3} ${r * 0.3} 0 0 1 ${-0.32 * r} ${r * 0.3} Z`}
            fill={light}
            opacity={0.45}
          />
        </G>
      );
    }
    case 'orbit':
    default:
      return (
        <G>
          <Ellipse rx={r} ry={r * 0.55} fill="none" stroke={stroke} strokeWidth={0.8} transform="rotate(24)" />
          <Ellipse
            rx={r * 0.72}
            ry={r * 0.4}
            fill="none"
            stroke={stroke}
            strokeWidth={0.6}
            opacity={0.7}
            transform="rotate(-32)"
          />
          <Circle r={r * 0.2 + emphasis * 2} fill={light} opacity={0.8} />
        </G>
      );
  }
}
