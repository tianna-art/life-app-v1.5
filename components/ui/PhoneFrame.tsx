import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '@/theme';

/**
 * crincran is a phone app. Opened in a desktop browser it would otherwise
 * stretch a one-column reading layout across a 1600px window, which breaks
 * both the typography and the radial MAP figure.
 *
 * So on web the app is held to a phone-width plate, centred on a black wall
 * like a framed print in the gallery. On a phone-sized browser the plate is
 * simply the whole window, so nothing is boxed in twice.
 *
 * On native this component is transparent — it renders its children and
 * nothing else.
 */

/** iPhone 16 Pro Max is 440pt wide; nothing wider is a phone. */
export const PHONE_MAX_WIDTH = 440;
/** Tall enough for the MAP figure, short enough for a laptop screen. */
export const PHONE_MAX_HEIGHT = 940;

/**
 * The plate to draw for a given window, or null when the window is already
 * phone-sized and should simply be used whole.
 */
export function platePlan(
  windowWidth: number,
  windowHeight: number
): { width: number; height: number } | null {
  if (windowWidth <= PHONE_MAX_WIDTH) return null;
  return { width: PHONE_MAX_WIDTH, height: Math.min(windowHeight, PHONE_MAX_HEIGHT) };
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web') return <>{children}</>;

  // A window already at phone size gets the full pane, no frame, no borders.
  const plate = platePlan(width, height);
  if (!plate) return <View style={styles.bare}>{children}</View>;

  return (
    <View style={styles.wall}>
      <View style={[styles.plate, plate]}>{children}</View>
    </View>
  );
}


const styles = StyleSheet.create({
  bare: { flex: 1, backgroundColor: colors.cream },
  wall: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayWall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  overlayPlate: { overflow: 'hidden', backgroundColor: 'transparent' },
  plate: {
    backgroundColor: colors.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
});
