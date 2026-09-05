import type { InputCategory } from '@/types';

/**
 * The three chips on HOME (§6).
 *
 * This list is closed. It is not a taxonomy the person maintains — it exists
 * only so a single tap can tell the AI what kind of moment it is reading. The
 * ids are stored in the database and must never be renamed.
 */
export interface InputCategoryDef {
  id: InputCategory;
  label: string;
  /** What belongs here. Used for the accessibility hint and the AI prompt. */
  covers: string[];
}

export const INPUT_CATEGORIES: readonly InputCategoryDef[] = [
  {
    id: 'progress',
    label: '進んだ',
    covers: ['小さな成功', '挑戦した', '何かを完成させた', '一歩動いた', '前よりできた'],
  },
  {
    id: 'friction',
    label: 'ひっかかった',
    covers: ['失敗した', 'うまくいかなかった', '違和感があった', '停滞した', '悔しかった'],
  },
  {
    id: 'moved',
    label: '心が動いた',
    covers: ['ときめいた', '気になった', '面白かった', '人との出来事', '発見した'],
  },
] as const;

const BY_ID = new Map(INPUT_CATEGORIES.map((c) => [c.id, c]));

export function inputCategoryLabel(id: InputCategory): string {
  return BY_ID.get(id)?.label ?? '';
}

export function isInputCategory(value: unknown): value is InputCategory {
  return typeof value === 'string' && BY_ID.has(value as InputCategory);
}

/**
 * Legacy v1.5 drawers mapped onto the three chips.
 *
 * The mapping is duplicated in the SQL migration; both are matched on the
 * frozen slug, never on the display name, and both keep the body untouched.
 */
export const LEGACY_SLUG_TO_INPUT_CATEGORY: Record<string, InputCategory> = {
  tsumiage: 'progress',
  kyokun: 'progress',
  hikkakari: 'friction',
  tokimeki: 'moved',
  kankeisei: 'moved',
  sonota: 'moved',
};

/** Anything the mapping does not know about lands in the widest drawer. */
export function inputCategoryForLegacySlug(slug: string | null | undefined): InputCategory {
  if (!slug) return 'moved';
  return LEGACY_SLUG_TO_INPUT_CATEGORY[slug] ?? 'moved';
}
