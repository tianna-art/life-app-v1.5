import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { BrassButton } from '@components/ui/BrassButton';
import { useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { CategoryMark } from '@components/ui/CategoryMark';
import { IconPicker } from '@components/settings/IconPicker';
import type { CategoryIcon } from '@/constants/icons';
import type { Category } from '@/types';

/**
 * Category settings (spec §3.4): add, rename, reorder, hide, show.
 * Hiding is a soft delete — a category with history is never removed.
 */
export default function CategorySettingsScreen() {
  const router = useRouter();
  const { data: categories } = useCategories(true);
  const { create, rename, setIcon, setActive, reorder } = useCategoryMutations();
  const [iconEditing, setIconEditing] = useState<Category | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const ordered = [...(categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (category: Category, delta: number) => {
    const ids = ordered.map((c) => c.id);
    const from = ids.indexOf(category.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    reorder.mutate(next);
  };

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="戻る"
        style={styles.back}
      >
        <Text style={styles.backLabel}>‹ 戻る</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          カテゴリー
        </Text>
        <Text style={styles.note}>
          カテゴリーは診断の軸ではなく、あなたの引き出しです。使わなくなったものは非表示にできます。過去の記録はそのまま残ります。
        </Text>

        <HairlineRule />

        {ordered.map((category, index) => (
          <View key={category.id} style={styles.row} testID={`settings-category-${category.slug}`}>
            <View style={styles.reorder}>
              <Pressable
                onPress={() => move(category, -1)}
                disabled={index === 0}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`${category.name} を上へ`}
                style={styles.reorderHit}
              >
                <Text style={[styles.arrow, index === 0 && styles.arrowDisabled]}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => move(category, 1)}
                disabled={index === ordered.length - 1}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`${category.name} を下へ`}
                style={styles.reorderHit}
              >
                <Text style={[styles.arrow, index === ordered.length - 1 && styles.arrowDisabled]}>
                  ↓
                </Text>
              </Pressable>
            </View>

            <Pressable
              testID={`edit-icon-${category.slug}`}
              onPress={() => setIconEditing(category)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={`${category.name} のしるしを変える`}
              style={({ pressed }) => [styles.markHit, pressed && styles.markPressed]}
            >
              <CategoryMark icon={category.icon} size={22} active={category.isActive} />
            </Pressable>

            {editingId === category.id ? (
              <TextInput
                testID={`rename-input-${category.slug}`}
                value={editingName}
                onChangeText={setEditingName}
                style={styles.renameInput}
                accessibilityLabel={`${category.name} の名前`}
                autoFocus
                onSubmitEditing={() => {
                  if (editingName.trim().length > 0) {
                    rename.mutate({ id: category.id, name: editingName.trim() });
                  }
                  setEditingId(null);
                }}
              />
            ) : (
              <Pressable
                onPress={() => {
                  setEditingId(category.id);
                  setEditingName(category.name);
                }}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`${category.name} の名前を変更`}
                style={styles.nameHit}
              >
                <Text style={[styles.name, !category.isActive && styles.nameHidden]}>
                  {category.name}
                </Text>
                {!category.isActive ? <Text style={styles.hiddenTag}>非表示</Text> : null}
              </Pressable>
            )}

            <Pressable
              testID={`toggle-active-${category.slug}`}
              onPress={() => setActive.mutate({ id: category.id, isActive: !category.isActive })}
              hitSlop={HIT_SLOP}
              accessibilityRole="switch"
              accessibilityState={{ checked: category.isActive }}
              accessibilityLabel={`${category.name} を${category.isActive ? '非表示' : '再表示'}`}
              style={styles.toggleHit}
            >
              <Text style={styles.toggle}>{category.isActive ? '非表示にする' : '再表示'}</Text>
            </Pressable>
          </View>
        ))}

        <HairlineRule />

        <View style={styles.addRow}>
          <TextInput
            testID="new-category-input"
            value={newName}
            onChangeText={setNewName}
            placeholder="新しいカテゴリー"
            placeholderTextColor={colors.ivoryFaint}
            style={styles.addInput}
            accessibilityLabel="新しいカテゴリー名"
            maxLength={20}
          />
          <BrassButton
            testID="add-category"
            label="追加"
            onPress={() => {
              const name = newName.trim();
              if (name.length === 0) return;
              create.mutate({ name });
              setNewName('');
            }}
            disabled={newName.trim().length === 0}
          />
        </View>
      </ScrollView>
      <IconPicker
        visible={iconEditing !== null}
        categoryName={iconEditing?.name ?? ''}
        value={iconEditing?.icon ?? 'orbit'}
        onPick={(icon: CategoryIcon) => {
          if (iconEditing) setIcon.mutate({ id: iconEditing.id, icon });
        }}
        onClose={() => setIconEditing(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  backLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  heading: { fontFamily: fonts.serif, fontSize: 26, color: colors.ivory },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.ivoryFaint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: MIN_TOUCH,
  },
  reorder: { flexDirection: 'row' },
  markHit: {
    minWidth: MIN_TOUCH - 12,
    minHeight: MIN_TOUCH - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markPressed: { opacity: 0.6 },
  reorderHit: { width: 28, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: colors.brassDim, fontSize: 15 },
  arrowDisabled: { color: colors.frame },
  nameHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH, justifyContent: 'flex-start' },
  name: { fontFamily: fonts.sans, fontSize: 16, color: colors.ivory },
  nameHidden: { color: colors.ivoryFaint },
  hiddenTag: { fontFamily: fonts.sans, fontSize: 10, color: colors.ivoryFaint },
  renameInput: {
    flex: 1,
    minHeight: MIN_TOUCH - 8,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brassDim,
  },
  toggleHit: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  toggle: { fontFamily: fonts.sans, fontSize: 12, color: colors.brassDim },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addInput: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
});
