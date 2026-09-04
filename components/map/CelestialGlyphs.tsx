import { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Category marks. Explicitly NOT plain circles: each is an abstraction of an
 * antique celestial atlas figure — sun, ringed planet, eight-point star,
 * crescent, comet, orbit.
 */
export type GlyphKind = 'sun' | 'ringed' | 'starburst' | 'crescent' | 'comet' | 'orbit';

export const GLYPH_KINDS: GlyphKind[] = ['sun', 'ringed', 'starburst', 'crescent', 'comet', 'orbit'];

/** Stable per-category glyph, so the same drawer always wears the same mark. */
export function glyphForKey(key: string): GlyphKind {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return GLYPH_KINDS[hash % GLYPH_KINDS.length] ?? 'sun';
}

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
