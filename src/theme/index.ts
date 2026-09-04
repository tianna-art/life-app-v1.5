/**
 * crincran theme — "暗めの西洋美術館 × プラネタリウム × 古い天体図".
 *
 * Rules encoded here:
 *  - deep black / midnight-navy grounds
 *  - ivory type
 *  - muted, antique brass gold used sparingly (accent, never fill)
 *  - serif for display, sans for controls
 *  - generous negative space
 */
import { Platform } from 'react-native';

export const colors = {
  /** Deepest ground — the gallery at night. */
  ink: '#07080D',
  /** Midnight navy, one step up from the ground. */
  night: '#0C1018',
  /** Raised surfaces: sheets, composer, cards. */
  surface: '#12161F',
  /** Hairlines and frames. */
  frame: '#242B38',
  frameSoft: 'rgba(214, 205, 184, 0.10)',

  /** Primary type — warm ivory, never pure white. */
  ivory: '#EDE7DA',
  /** Secondary type. */
  ivoryDim: 'rgba(237, 231, 218, 0.62)',
  /** Tertiary type / captions. */
  ivoryFaint: 'rgba(237, 231, 218, 0.38)',

  /** Antique brass. Accent only. */
  brass: '#C2A15C',
  brassDim: 'rgba(194, 161, 92, 0.55)',
  brassFaint: 'rgba(194, 161, 92, 0.18)',

  /** Star light. */
  star: '#F3EEE2',
  starDim: 'rgba(243, 238, 226, 0.45)',

  /** Semantic edge line in the map — deliberately barely there. */
  edge: 'rgba(194, 161, 92, 0.22)',
  edgeSemantic: 'rgba(160, 178, 214, 0.20)',

  danger: '#B4635A',
  scrim: 'rgba(4, 5, 9, 0.86)',
} as const;

export const fonts = {
  /** Display serif — museum plaque. */
  serif: Platform.select({
    ios: 'Times New Roman',
    android: 'serif',
    default: 'Georgia, "Times New Roman", serif',
  }) as string,
  serifItalic: Platform.select({
    ios: 'Times New Roman',
    android: 'serif',
    default: 'Georgia, serif',
  }) as string,
  /** UI sans — controls and body. */
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
  }) as string,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 36,
  xxl: 56,
  /** Generous gallery margin. */
  gallery: 28,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const type = {
  /** SEPTEMBER 2026 */
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 12,
    letterSpacing: 3.4,
    color: colors.ivoryFaint,
  },
  /** Monthly / yearly titles. */
  display: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 34,
    color: colors.ivory,
  },
  displaySmall: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 28,
    color: colors.ivory,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.ivory,
  },
  bodyDim: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ivoryDim,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ivoryFaint,
  },
  control: {
    fontFamily: fonts.sans,
    fontSize: 14,
    letterSpacing: 0.6,
    color: colors.ivory,
  },
} as const;

/** Minimum touch target, kept above the 44pt guideline. */
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
export const MIN_TOUCH = 44;

export const theme = { colors, fonts, spacing, radii, type } as const;
export type Theme = typeof theme;
