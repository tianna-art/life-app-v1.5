/**
 * User-facing strings.
 *
 * The words themselves come from the preview, which is the specification, and
 * are generated rather than retyped — see scripts/extract-from-preview.mjs.
 * What lives here is the guard: the register this product must never slip
 * into, checked by __tests__/copy.test.ts against every shipped file.
 *
 * @declares-forbidden-register — this is the guard list itself.
 */
export { COPY } from './generated/preview';

/**
 * Strings the preview does not have.
 *
 * Everything the preview covers is generated from it. This is for the few
 * places the app goes beyond it — here, because a summary the person rewrote
 * has to be distinguishable from the one the reading produced, and the preview
 * has no such distinction to copy. Keep this list short: a string that belongs
 * in the preview should be added there instead.
 */
export const LOCAL_COPY = {
  /** Marks a 要約 as the person's own words rather than the reading's. */
  summaryIsYours: '自分の言葉',
} as const;

/**
 * None of these may appear in shipped copy.
 *
 * The first group is diagnosis — telling someone who they are. The second is
 * rescue — turning what happened into a lesson on their behalf. The third is
 * measurement: a direction is not a destination, so nothing counts progress
 * toward it, and an empty month is not a shortfall.
 */
export const FORBIDDEN_PHRASES = [
  'あなたは',
  '本当のあなた',
  '意味がありました',
  '成長しました',
  '記録が足りません',
  '足りません',
  '達成率',
  '一致率',
  '進捗',
  '未達',
] as const;
