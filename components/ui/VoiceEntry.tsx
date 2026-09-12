import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { HIT_SLOP, colors, fonts, spacing } from '@/theme';
import { COPY } from '@/constants/copy';

/**
 * 音声で入力 — the door, standing where it will be, with nothing behind it yet.
 *
 * The preview puts this under every free-text field and has it say
 * 「音声はまだ入っていません」 when pressed, and that is exactly right: a door
 * that appears the day it opens teaches nobody that it was coming, and a
 * greyed-out control that says nothing when pressed reads as broken. So it is
 * here, it is pressable, and it tells the truth.
 *
 * What it will do when it works is put the transcript straight into the body,
 * unedited. Tidying somebody's own words on the way in is the one thing this
 * product must not do, and it would be easiest to do here.
 */
export function VoiceEntry({ testID = 'voice-entry' }: { testID?: string }) {
  const [said, setSaid] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        testID={testID}
        onPress={() => setSaid(true)}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={COPY.futureVoice}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Svg width={15} height={15} viewBox="-9 -9 18 18">
          <Path
            d="M 0 -7.5 C 1.4 -7.5 2.5 -6.4 2.5 -5 V -0.5 C 2.5 0.9 1.4 2 0 2 C -1.4 2 -2.5 0.9 -2.5 -0.5 V -5 C -2.5 -6.4 -1.4 -7.5 0 -7.5 Z M -5 -1 C -5 1.8 -2.8 4 0 4 C 2.8 4 5 1.8 5 -1 M 0 4 V 7.5"
            fill="none"
            stroke={colors.orange}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.label}>{COPY.futureVoice}</Text>
      </Pressable>
      {said ? (
        <Text style={styles.soon} accessibilityLiveRegion="polite">
          {COPY.voiceSoon}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint },
  soon: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
});
