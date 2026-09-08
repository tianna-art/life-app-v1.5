import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { ANTENNAS, ANTENNA_ORDER, MAX_ANTENNAS } from '@/constants/log';
import type { AntennaId } from '@/types';

interface AntennaPickerProps {
  value: readonly AntennaId[];
  onChange: (value: AntennaId[]) => void;
}

/**
 * What this month is for.
 *
 * Up to two, and picking again next month is what makes two enough. A third
 * axis is how a month stops being about anything: everything gets a little
 * attention and nothing accumulates enough evidence to say anything by the
 * end of it.
 *
 * Each card says when it is worth choosing and what the month gives back. The
 * first is a situation the person recognises, not a description of a feature;
 * the second is material rather than a verdict, because nothing here promises
 * an outcome. Neither is a goal: an antenna decides what gets noticed, and
 * that is all it does.
 *
 * Tapping a chosen one puts it back. At the ceiling the others go quiet rather
 * than disappearing — a card that vanishes reads as a bug, and one that
 * refuses a tap silently reads as broken.
 */
export function AntennaPicker({ value, onChange }: AntennaPickerProps) {
  const full = value.length >= MAX_ANTENNAS;

  return (
    <View style={styles.list} testID="antenna-picker">
      {ANTENNA_ORDER.map((id) => {
        const antenna = ANTENNAS[id];
        const chosen = value.includes(id);
        const muted = full && !chosen;

        return (
          <Pressable
            key={id}
            testID={`antenna-${id}`}
            onPress={() => {
              if (chosen) onChange(value.filter((x) => x !== id));
              else if (!full) onChange([...value, id]);
            }}
            hitSlop={HIT_SLOP}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen, disabled: muted }}
            accessibilityLabel={antenna.title}
            accessibilityHint={antenna.recommendedWhen}
            style={({ pressed }) => [
              styles.card,
              chosen && styles.chosen,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.title, chosen && styles.titleChosen, muted && styles.muted]}>
              {antenna.title}
            </Text>
            <Text style={[styles.line, muted && styles.muted]}>{antenna.recommendedWhen}</Text>
            <Text style={[styles.line, muted && styles.muted]}>{antenna.provides}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    padding: spacing.md,
    gap: 4,
  },
  chosen: { borderColor: colors.brass, backgroundColor: colors.brassFaint },
  pressed: { opacity: 0.6 },
  title: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 27, color: colors.ivory },
  titleChosen: { color: colors.brass },
  line: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryDim },
  muted: { opacity: 0.45 },
});
