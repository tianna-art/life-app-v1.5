import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import type { VisionItem, VisionWord } from '@/types';

/**
 * ビジョンボード — the scenery, sitting above every period.
 *
 * It opens and closes on the map rather than living in settings, because it is
 * the thing the rest of the screen is measured against, not a preference.
 *
 * Before anything is in it, this is an invitation and says plainly that a
 * direction is not required first. Nothing here is a decision: the items may
 * contradict each other and the list may be short.
 */
export function VisionBoard({
  items,
  words,
  open,
  onToggle,
  onStart,
}: {
  items: VisionItem[];
  words: VisionWord[];
  open: boolean;
  onToggle: () => void;
  onStart: () => void;
}) {
  const empty = items.length === 0 && words.length === 0;

  if (empty) {
    return (
      <View style={styles.intro} testID="vision-intro">
        <Text style={styles.eyebrow}>{COPY.visionEyebrow}</Text>
        <Text style={styles.introTitle}>{COPY.visionTitle}</Text>
        <Text style={styles.introBody}>{COPY.visionBody}</Text>
        <Pressable
          testID="vision-start"
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={COPY.visionGo}
          style={({ pressed }) => [styles.start, pressed && styles.pressed]}
        >
          <Text style={styles.startLabel}>{COPY.visionGo}</Text>
        </Pressable>
        <Text style={styles.later}>{COPY.visionLaterNote}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="vision-board">
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title} accessibilityRole="header">
            {COPY.visionLabel}
          </Text>
          <Text style={styles.sub}>{COPY.visionBoardSub}</Text>
        </View>
        <Pressable
          testID="vision-toggle"
          onPress={onToggle}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={open ? COPY.visionClose : COPY.visionOpen}
          accessibilityState={{ expanded: open }}
        >
          <Text style={styles.quiet}>{open ? COPY.visionClose : COPY.visionOpen}</Text>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.body} testID="vision-body">
          <View style={styles.items}>
            {items.map((item) => (
              <View key={item.id} style={styles.item}>
                <Text style={styles.itemText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {words.length > 0 ? (
            <View style={styles.words}>
              <Text style={styles.wordsLabel}>{COPY.visionWords}</Text>
              {words.map((word) => (
                <Text key={word.id} style={styles.word}>{`「${word.text}」`}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.serif, fontSize: 19, color: colors.brown },
  sub: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
  quiet: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownDim },
  body: {
    backgroundColor: 'rgba(83, 64, 34, 0.04)',
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  item: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemText: { fontFamily: fonts.sans, fontSize: 14, color: colors.brown },
  words: { alignItems: 'center', gap: spacing.xs },
  wordsLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2, color: colors.brownFaint },
  word: { fontFamily: fonts.serif, fontSize: 14, color: colors.brownDim },

  intro: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.orange },
  introTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.brown, textAlign: 'center' },
  introBody: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 21,
    color: colors.brownDim,
    textAlign: 'center',
  },
  start: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
  },
  startLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.onBrown },
  pressed: { opacity: 0.62 },
  later: { fontFamily: fonts.sans, fontSize: 10, color: colors.brownFaint },
});
