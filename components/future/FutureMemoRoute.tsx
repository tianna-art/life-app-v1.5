import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { DATE_KINDS, FUTURE_TYPES, TYPE_LABEL, DONE_TYPE_LABEL } from '@/constants/generated/preview';
import { Chip } from '@components/ui/Chip';
import { useFutureMemoMutations, useFutureMemos } from '@/hooks/useFutureMemos';
import type { DateKind, FutureMemo, FutureType } from '@/types';

type Shelf = 'future' | 'completed';

/**
 * 未来メモ — things noticed now and left for a later self.
 *
 * Two shelves: これから and 完了. Nothing counts what is on either. A list of
 * things you have not done yet is not a backlog, and saying how many are on it
 * turns noticing into an obligation.
 */
export function FutureMemoRoute() {
  const [shelf, setShelf] = useState<Shelf>('future');
  const [type, setType] = useState<FutureType>('interest');
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [dateKind, setDateKind] = useState<DateKind>('none');

  const { data: memos } = useFutureMemos();
  const { create, update } = useFutureMemoMutations();

  const shown = useMemo(
    () => (memos ?? []).filter((m) => (shelf === 'future' ? m.status === 'future' : m.status === 'completed')),
    [memos, shelf]
  );

  const canSave = title.trim().length > 0;

  return (
    <View style={styles.wrap} testID="future-route">
      <Text style={styles.lead}>{COPY.subInMindSub}</Text>

      <View style={styles.typeRow}>
        {FUTURE_TYPES.map(([id, label]) => (
          <Chip
            key={id}
            testID={`future-type-${id}`}
            label={label}
            selected={type === id}
            onPress={() => setType(id as FutureType)}
          />
        ))}
      </View>

      <TextInput
        testID="future-title"
        value={title}
        onChangeText={setTitle}
        placeholder={COPY.sampleTitle}
        placeholderTextColor={colors.brownFaint}
        style={styles.title}
        accessibilityLabel="未来メモのタイトル"
      />
      <TextInput
        testID="future-memo"
        value={memo}
        onChangeText={setMemo}
        multiline
        style={styles.memo}
        placeholderTextColor={colors.brownFaint}
        accessibilityLabel="未来メモのメモ"
        textAlignVertical="top"
      />

      <View style={styles.typeRow}>
        {(Object.entries(DATE_KINDS) as [DateKind, string][]).map(([id, label]) => (
          <Chip
            key={id}
            testID={`future-date-${id}`}
            label={label}
            selected={dateKind === id}
            onPress={() => setDateKind(id)}
          />
        ))}
      </View>

      <Pressable
        testID="future-save"
        onPress={() => {
          if (!canSave) return;
          create.mutate({
            type,
            title,
            memo,
            dateKind,
            // いつでも carries no date, so none is invented for it.
            targetDate: null,
          });
          setTitle('');
          setMemo('');
          setDateKind('none');
        }}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={COPY.futureAddHere}
        style={({ pressed }) => [styles.add, !canSave && styles.addIdle, pressed && styles.pressed]}
      >
        <Text style={[styles.addLabel, !canSave && styles.addLabelIdle]}>{COPY.futureAddHere}</Text>
      </Pressable>

      <View style={styles.shelfRow}>
        {(['future', 'completed'] as Shelf[]).map((id) => (
          <Pressable
            key={id}
            testID={`future-shelf-${id}`}
            onPress={() => setShelf(id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="tab"
            accessibilityState={{ selected: shelf === id }}
            style={styles.shelfTab}
          >
            <Text style={[styles.shelfLabel, shelf === id && styles.shelfLabelOn]}>
              {id === 'future' ? 'これから' : '完了'}
            </Text>
          </Pressable>
        ))}
      </View>

      {shown.length === 0 ? (
        <Text style={styles.empty}>
          {shelf === 'future' ? COPY.futureEmptyHint : COPY.futureNoneDone}
        </Text>
      ) : (
        shown.map((memoRow) => (
          <MemoRow
            key={memoRow.id}
            memo={memoRow}
            onToggleStar={() =>
              update.mutate({ id: memoRow.id, patch: { favorite: !memoRow.favorite } })
            }
            onComplete={() =>
              update.mutate({
                id: memoRow.id,
                patch: { status: 'completed', completedAt: new Date().toISOString() },
              })
            }
            onReturn={() =>
              update.mutate({ id: memoRow.id, patch: { status: 'future', completedAt: null } })
            }
          />
        ))
      )}
    </View>
  );
}

function MemoRow({
  memo,
  onToggleStar,
  onComplete,
  onReturn,
}: {
  memo: FutureMemo;
  onToggleStar: () => void;
  onComplete: () => void;
  onReturn: () => void;
}) {
  const done = memo.status === 'completed';
  // 「観たい映画」 becomes a lie once it has been watched, so a finished card
  // is named for what it was at the time.
  const kind = done ? DONE_TYPE_LABEL[memo.type] : TYPE_LABEL[memo.type];

  return (
    <View style={styles.row} testID={`future-row-${memo.id}`}>
      <View style={styles.rowHead}>
        <Text style={styles.kind}>{kind}</Text>
        <Pressable
          testID={`future-star-${memo.id}`}
          onPress={onToggleStar}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={memo.favorite ? '★を外す' : '★を付ける'}
          accessibilityState={{ selected: memo.favorite }}
          style={styles.star}
        >
          <Text style={[styles.starMark, memo.favorite && styles.starOn]}>★</Text>
        </Pressable>
      </View>
      <Text style={styles.rowTitle}>{memo.title}</Text>
      {memo.memo.length > 0 ? <Text style={styles.rowMemo}>{memo.memo}</Text> : null}
      <Text style={styles.when}>{DATE_KINDS[memo.dateKind]}</Text>
      <Pressable
        testID={`future-toggle-${memo.id}`}
        onPress={done ? onReturn : onComplete}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={done ? COPY.futureBackToList : COPY.futureFinish}
        style={styles.rowAction}
      >
        <Text style={styles.rowActionLabel}>{done ? COPY.futureBackToList : COPY.futureFinish}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  lead: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  title: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  memo: {
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    color: colors.brown,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  add: {
    minHeight: MIN_TOUCH,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIdle: { backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  addLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.onBrown },
  addLabelIdle: { color: colors.brownFaint },
  pressed: { opacity: 0.62 },
  shelfRow: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm },
  shelfTab: { paddingVertical: spacing.xs },
  shelfLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  shelfLabelOn: { color: colors.brown },
  empty: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownFaint },
  row: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontFamily: fonts.sans, fontSize: 11, color: colors.orange },
  star: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  starMark: { fontSize: 16, color: colors.brownFaint },
  starOn: { color: colors.orange },
  rowTitle: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 24, color: colors.brown },
  rowMemo: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 21, color: colors.brownDim },
  when: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
  rowAction: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  rowActionLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.brownDim },
});
