import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { VisionIntro } from './VisionIntro';
import type { VisionItem, VisionWord } from '@/types';

/**
 * ビジョンボード — the scenery, sitting above every period.
 *
 * It opens and closes on the map rather than living in settings, because it is
 * the thing the rest of the screen is measured against, not a preference.
 *
 * Before anything is in it, the invitation is shown instead — the same card
 * the input screen shows, from the same file. Nothing here is a decision: the
 * items may contradict each other and the list may be short.
 */
export function VisionBoard({
  items,
  words,
  open,
  onToggle,
}: {
  items: VisionItem[];
  words: VisionWord[];
  open: boolean;
  onToggle: () => void;
}) {
  const empty = items.length === 0 && words.length === 0;

  // One card, drawn in one place. 現在地 and 入力 show the same invitation, so
  // it cannot drift into two that agree about the words and disagree about
  // what pressing them does.
  if (empty) return <VisionIntro />;

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

});
