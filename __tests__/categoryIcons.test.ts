/**
 * The icon vocabulary is stored in the database, so the TypeScript list and the
 * SQL constraint have to agree. If they drift, a perfectly valid pick in the
 * app becomes a constraint violation on save — and only for the user, at the
 * moment they try it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  coerceIcon,
  fallbackIcon,
  isCategoryIcon,
} from '@/constants/icons';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

const migration = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '20260904100000_category_icons.sql'),
  'utf8'
);

describe('the icon vocabulary', () => {
  it('matches the check constraint in the migration exactly', () => {
    const clause = migration.match(/icon in \(([^)]+)\)/);
    expect(clause).not.toBeNull();
    const allowed = [...(clause?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect([...allowed].sort()).toEqual([...CATEGORY_ICONS].sort());
  });

  it('has no duplicates', () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });

  it('seeds every default category with a mark the database will accept', () => {
    for (const seed of DEFAULT_CATEGORIES) {
      expect(isCategoryIcon(seed.icon)).toBe(true);
    }
  });

  it('gives the seeded marks the same values the migration writes', () => {
    for (const seed of DEFAULT_CATEGORIES) {
      if (seed.icon === DEFAULT_CATEGORY_ICON) continue; // left at the column default
      const line = new RegExp(`set icon = '${seed.icon}'\\s+where slug = '${seed.slug}'`);
      expect(migration).toMatch(line);
    }
  });

  it('is what the column default falls back to', () => {
    expect(migration).toContain(`default '${DEFAULT_CATEGORY_ICON}'`);
  });
});

describe('a category with no mark of its own', () => {
  it('always lands on a real mark', () => {
    for (const key of ['tokimeki', '', 'ユーザーが作った引き出し', 'x'.repeat(200)]) {
      expect(isCategoryIcon(fallbackIcon(key))).toBe(true);
    }
  });

  it('keeps the same mark between two readings — nothing shuffles', () => {
    expect(fallbackIcon('kankeisei')).toBe(fallbackIcon('kankeisei'));
  });

  it('reads a stored value when there is one, and falls back when there is not', () => {
    expect(coerceIcon('compass', 'kyokun')).toBe('compass');
    // A database that has not run the migration sends nothing at all.
    expect(coerceIcon(undefined, 'kyokun')).toBe(fallbackIcon('kyokun'));
    // Junk is not trusted just because it arrived.
    expect(coerceIcon('rocket', 'kyokun')).toBe(fallbackIcon('kyokun'));
    expect(coerceIcon(7, 'kyokun')).toBe(fallbackIcon('kyokun'));
  });
});
