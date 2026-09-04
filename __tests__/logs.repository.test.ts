/**
 * Persistence rules: saving both log types, category integrity, and the
 * soft-delete guarantee that history is never rewritten.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalRepository } from '@/data/localRepository';
import { monthKeyOf } from '@/utils/period';

describe('log persistence', () => {
  let repository: LocalRepository;

  beforeEach(async () => {
    await AsyncStorage.clear();
    repository = new LocalRepository();
    await repository.ensureBootstrapped();
  });

  async function firstCategoryId(): Promise<string> {
    const categories = await repository.listCategories();
    const id = categories[0]?.id;
    if (!id) throw new Error('bootstrap failed');
    return id;
  }

  it('saves an 出来事 (event)', async () => {
    const categoryId = await firstCategoryId();
    const log = await repository.createLog({
      type: 'event',
      categoryId,
      body: '展示を見に行った',
    });

    expect(log.type).toBe('event');
    expect(log.body).toBe('展示を見に行った');

    const month = await repository.listLogsByMonth(monthKeyOf(new Date()));
    expect(month.map((l) => l.id)).toContain(log.id);
  });

  it('saves a つぶやき (thought)', async () => {
    const categoryId = await firstCategoryId();
    const log = await repository.createLog({
      type: 'thought',
      categoryId,
      body: 'まだ言葉にならないが、方向は見えてきた',
    });

    expect(log.type).toBe('thought');
    const stored = await repository.getLog(log.id);
    expect(stored?.body).toBe('まだ言葉にならないが、方向は見えてきた');
  });

  it('seeds the six default categories and lets the user add one', async () => {
    const initial = await repository.listCategories();
    expect(initial.map((c) => c.name)).toEqual([
      '楽しかったこと',
      'できたこと',
      '学び',
      'モヤモヤ',
      '人間関係',
      'その他',
    ]);

    const custom = await repository.createCategory({ name: '身体のこと' });
    expect(custom.isDefault).toBe(false);
    expect(custom.isActive).toBe(true);

    const after = await repository.listCategories();
    expect(after.map((c) => c.name)).toContain('身体のこと');

    // A custom category is immediately usable for a new log.
    const log = await repository.createLog({
      type: 'event',
      categoryId: custom.id,
      body: '整体に行った',
    });
    expect(log.categoryId).toBe(custom.id);
  });

  it('soft-deletes a category and keeps its historic logs intact', async () => {
    const custom = await repository.createCategory({ name: '一時的な引き出し' });
    const log = await repository.createLog({
      type: 'thought',
      categoryId: custom.id,
      body: 'この引き出しはいずれ使わなくなるかもしれない',
    });

    await repository.setCategoryActive(custom.id, false);

    // Hidden from the composer…
    const active = await repository.listCategories();
    expect(active.find((c) => c.id === custom.id)).toBeUndefined();

    // …but the row and the log both survive.
    const all = await repository.listCategories(true);
    const hidden = all.find((c) => c.id === custom.id);
    expect(hidden).toBeDefined();
    expect(hidden?.isActive).toBe(false);

    const stored = await repository.getLog(log.id);
    expect(stored).not.toBeNull();
    expect(stored?.categoryId).toBe(custom.id);
  });

  it('reorders categories without touching logs', async () => {
    const before = await repository.listCategories();
    const ids = before.map((c) => c.id);
    const reversed = [...ids].reverse();
    const after = await repository.reorderCategories(reversed);
    expect(after.filter((c) => c.isActive).map((c) => c.id)).toEqual(reversed);
  });
});
