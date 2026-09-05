import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts } from '@/theme';
import { LABELS } from '@/constants/copy';
import type { YearDirection } from '@/types';

interface DirectionPlateProps {
  direction: YearDirection | null | undefined;
  onPress: () => void;
}

/**
 * The year's theme, standing above everything else (§5).
 *
 * §5 calls it the YEAR INITIAL THEME and says it is decided again at the end
 * of the year, so it is shown as a heading rather than as a target: no
 * progress bar, no count of what has been done towards it, nothing that could
 * be read as a distance from it (§1).
 *
 * The lenses sit under it because they are what makes the theme concrete —
 * they are what the reading is actually watching for, and seeing them is what
 * turns "自分の感性を、外の世界へ" from a slogan into a direction.
 *
 * Absent until the person has been through the opening screens, and absent is
 * a working state: the whole app runs without one.
 */
export function DirectionPlate({ direction, onPress }: DirectionPlateProps) {
  const theme = direction?.initialTheme;
  const lenses = direction?.progressionLenses ?? [];
  if (!theme && lenses.length === 0) return null;

  return (
    <Pressable
      testID="direction-plate"
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${LABELS.direction} ${theme ?? ''}`}
      accessibilityHint="今年の方向をひらきます"
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <Text style={styles.eyebrow}>{LABELS.direction}</Text>
      {theme ? <Text style={styles.theme}>{theme}</Text> : null}
      {lenses.length > 0 ? (
        <View style={styles.lenses}>
          {lenses.map((lens, index) => (
            <Text key={lens} style={styles.lens}>
              {index > 0 ? '· ' : ''}
              {lens}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3, alignItems: 'center' },
  pressed: { opacity: 0.6 },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 2.6,
    color: colors.ivoryFaint,
  },
  theme: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    color: colors.ivory,
    textAlign: 'center',
  },
  lenses: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  lens: { fontFamily: fonts.sans, fontSize: 11, color: colors.brassDim },
});
