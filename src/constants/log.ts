/**
 * The input vocabulary, for the screens.
 *
 * `src/domain/antennas.ts` is the source of truth; this file only re-exports
 * what the UI reaches for and adds the lookups a screen needs. Nothing here
 * restates a label — a label that exists twice is a label that will disagree
 * with itself.
 */
export {
  ANTENNAS,
  ANTENNA_ORDER,
  ALL_CATEGORIES,
  MAX_ANTENNAS,
  OTHER_DETAIL,
  antennaOfCategory,
  categoriesFor,
  getCategoryById,
  getDetailById,
  serializeLogForAI,
} from '@/domain/antennas';

import {
  ALL_CATEGORIES,
  ANTENNAS,
  ANTENNA_ORDER,
  getCategoryById,
  getDetailById,
} from '@/domain/antennas';
import type { AntennaId, CategoryId, DetailId } from '@/domain/antennas';
import type { LegacyLogType, LegacyMomentTag } from '@/types';

const CATEGORY_BY_ID = new Map(ALL_CATEGORIES.map((c) => [c.id, c]));

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORY_BY_ID.has(value as CategoryId);
}

export function isAntennaId(value: unknown): value is AntennaId {
  return typeof value === 'string' && (ANTENNA_ORDER as readonly string[]).includes(value);
}

/** 「できた」「しんどかった」. Empty for an id the app no longer knows. */
export function categoryLabel(id: CategoryId | null | undefined): string {
  return id ? (CATEGORY_BY_ID.get(id)?.label ?? '') : '';
}

/** 「初めてできた」. Needs the category: the same detail id means different
 *  things under different ones — `person` is a source of influence under
 *  ときめき and someone you were with under 活かし方. */
export function detailLabel(
  categoryId: CategoryId | null | undefined,
  detailId: DetailId | null | undefined
): string {
  if (!categoryId || !detailId || !CATEGORY_BY_ID.has(categoryId)) return '';
  return getDetailById(categoryId, detailId)?.label ?? '';
}

/** 「前進」. Short enough for a map label or a summary line. */
export function antennaShortLabel(id: AntennaId): string {
  return ANTENNAS[id].shortLabel;
}

export function isDetailOf(categoryId: CategoryId, detailId: DetailId): boolean {
  return getDetailById(categoryId, detailId) !== null;
}

/** Every detail the given category offers, `その他` last. */
export function detailsFor(categoryId: CategoryId) {
  return getCategoryById(categoryId).details;
}

// ---------------------------------------------------------------------------
// v3 / v4 rows
// ---------------------------------------------------------------------------

/**
 * The doors and moment tags records were written under before the antennas.
 *
 * Kept so the archive can still print what an old row carries. They are not
 * mapped onto categories: a door is not a category, and guessing which one a
 * three-year-old 「つぶやき」 belongs to would file the person's record for
 * them under a vocabulary they never saw.
 */
export const LEGACY_LOG_TYPE_JA: Record<LegacyLogType, string> = {
  self_action: '自分の行動',
  relationship: '人との関わり',
  thought: 'つぶやき',
};

export const LEGACY_MOMENT_TAG_JA: Record<LegacyMomentTag, string> = {
  enjoyed: '楽しかった',
  tried: 'やってみた',
  first_time: '初めて',
  friction: 'モヤモヤ',
  changed: '変えてみた',
  discovered: '発見した',
  self_decided: '自分で決めた',
};

export function isLegacyLogType(value: unknown): value is LegacyLogType {
  return value === 'self_action' || value === 'relationship' || value === 'thought';
}

export function isLegacyMomentTag(value: unknown): value is LegacyMomentTag {
  return typeof value === 'string' && value in LEGACY_MOMENT_TAG_JA;
}

/** v3 rows carried a drawer rather than a door. */
export function logTypeForLegacy(value: string | null | undefined): LegacyLogType {
  if (isLegacyLogType(value)) return value;
  // 'event' was "something that happened", which is what self_action meant.
  return 'self_action';
}
