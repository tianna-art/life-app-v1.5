import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { DATE_KINDS, TYPE_LABEL } from '@/constants/generated/preview';
import type { FutureMemo } from '@/types';

/** Three at most. This is a glance at what is on your mind, not the list. */
const MAX_SHOWN = 3;

/**
 * 心に浮かんだこと — the starred 未来メモ.
 *
 * Only the starred ones reach the map, and no count of the rest appears
 * anywhere near them: a number would turn a shelf of things you noticed into
 * a pile of things you have not done.
 */
export function StarredMemos({
  memos,
  onSeeAll,
  onAdd,
}: {
  memos: FutureMemo[];
  onSeeAll: () => void;
  onAdd: () => void;
}) {
  const starred = memos.filter((m) => m.favorite && m.status === 'future').slice(0, MAX_SHOWN);

  return (
    <View style={styles.wrap} testID="starred-memos">
      {starred.length === 0 ? (
        <Text style={styles.empty}>{COPY.futureEmptyHint}</Text>
      ) : (
        starred.map((memo) => (
          <View key={memo.id} style={styles.card} testID={`starred-${memo.id}`}>
            <View style={styles.head}>
              <Text style={styles.kind}>{TYPE_LABEL[memo.type]}</Text>
              <Text style={styles.when}>
                {memo.targetDate ? `${memo.targetDate} ${DATE_KINDS[memo.dateKind]}` : DATE_KINDS.none}
              </Text>
            </View>
            <Text style={styles.title}>{memo.title}</Text>
            {memo.memo.length > 0 ? <Text style={styles.memo}>{memo.memo}</Text> : null}
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Pressable
          testID="memos-see-all"
          onPress={onSeeAll}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={COPY.futureSeeAll}
        >
          <Text style={styles.quiet}>{`${COPY.futureSeeAll} ＞`}</Text>
        </Pressable>
        <Pressable
          testID="memos-add"
          onPress={onAdd}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={COPY.futureAddHere}
        >
          <Text style={styles.quiet}>{COPY.futureAddHere}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  empty: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontFamily: fonts.sans, fontSize: 11, color: colors.orange },
  when: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
  title: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 24, color: colors.brown },
  memo: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownDim },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs },
  quiet: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownDim },
});
