/**
 * crincran theme — 生成り色の紙と、焦茶の字。
 *
 * The previous theme was a dark museum at night. This one is its opposite and
 * the two must not be mixed: a single leftover ivory-on-black surface reads as
 * a different app. The tokens below are the whole palette — nothing outside
 * this file should name a colour.
 *
 * Rules encoded here:
 *  - cream ground, paper for anything lifted off it
 *  - butter yellow carries 方向 (the year plate and the month plate inside it)
 *  - brown is type and the ground of dark buttons; brown-deep is for reversed
 *    surfaces only, because as a fill it reads black
 *  - orange is the accent: the name of a kind, and the way into something unset
 *  - moss is decoration only; water belongs to 感情クエスト and nowhere else
 *  - a selected tab is a thin frame and brown type, never a filled block
 */
import { Platform } from 'react-native';

export const colors = {
  /** The ground. */
  cream: '#FAF6EC',
  /** One step up from the ground: cards, sheets, the month plate. */
  paper: '#FFFDF6',
  /** 方向 — the year plate, and the band that carries it. */
  butter: '#FDF7BD',
  butterSoft: '#FBEFB8',

  /** Type, and the fill of dark buttons. */
  brown: '#534022',
  /** Reversed surfaces only. As a fill this reads black, so never a card. */
  brownDeep: '#392E1C',
  brownDim: 'rgba(83, 64, 34, 0.62)',
  brownFaint: 'rgba(83, 64, 34, 0.36)',
  /** The only rule colour. */
  hairline: 'rgba(83, 64, 34, 0.16)',

  /** Accent: the name of a kind, and the way into something not yet set. */
  orange: '#DA7443',
  orangeSoft: 'rgba(218, 116, 67, 0.14)',
  /** A thin orange rule — an invitation's edge, never a warning's. */
  orangeLine: 'rgba(218, 116, 67, 0.34)',

  /** Decoration only — never type, never a state. */
  moss: '#7C8A5F',
  /** 感情クエスト only. */
  water: '#4F8484',

  /** Text on brown. */
  onBrown: '#FAF6EC',

  scrim: 'rgba(57, 46, 28, 0.34)',
  danger: '#B4635A',
} as const;

export const fonts = {
  serif: Platform.select({
    ios: 'Hiragino Mincho ProN',
    android: 'serif',
    default: 'Georgia, "Times New Roman", "Hiragino Mincho ProN", serif',
  }) as string,
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif',
  }) as string,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 36,
  xxl: 56,
  /** The side margin. Every screen keeps this, and nothing indents past it. */
  gallery: 24,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 22,
  xl: 26,
  pill: 999,
} as const;

export const type = {
  /** Small caps-ish label above a block. */
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.brownFaint,
  },
  /** Screen and section headings. */
  display: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 31,
    color: colors.brown,
  },
  displaySmall: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 25,
    color: colors.brown,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 24,
    color: colors.brown,
  },
  bodyDim: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.brownDim,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 19,
    color: colors.brownFaint,
  },
  control: {
    fontFamily: fonts.sans,
    fontSize: 14,
    letterSpacing: 0.4,
    color: colors.brown,
  },
} as const;

/** Minimum touch target, kept above the 44pt guideline. */
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
export const MIN_TOUCH = 44;

export const theme = { colors, fonts, spacing, radii, type } as const;
export type Theme = typeof theme;
