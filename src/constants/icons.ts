/**
 * Category marks.
 *
 * A category is a drawer the user chose, so it gets a face they chose too.
 * The vocabulary is fixed and drawn from an old celestial atlas rather than
 * left open to arbitrary emoji: the whole surface is a dark planetarium and a
 * yellow smiley would tear a hole in it. Ten marks is enough to tell six to
 * ten drawers apart at a glance without turning the picker into a catalogue.
 *
 * These identifiers are stored in the database, so they are append-only:
 * never rename one, never remove one that a row might still point at.
 */
export const CATEGORY_ICONS = [
  'sun',
  'ringed',
  'starburst',
  'crescent',
  'comet',
  'orbit',
  'constellation',
  'compass',
  'spiral',
  'phases',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const DEFAULT_CATEGORY_ICON: CategoryIcon = 'orbit';

export function isCategoryIcon(value: unknown): value is CategoryIcon {
  return typeof value === 'string' && (CATEGORY_ICONS as readonly string[]).includes(value);
}

/**
 * The mark for a category that has none of its own — one made before icons
 * existed, or one that arrived from a client that did not send it. Hashing the
 * key keeps it stable: the same drawer always wears the same mark, so nothing
 * shuffles under the user between two openings of the app.
 */
export function fallbackIcon(key: string): CategoryIcon {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CATEGORY_ICONS[hash % CATEGORY_ICONS.length] ?? DEFAULT_CATEGORY_ICON;
}

/** Reads whatever the row carried, and always yields a usable mark. */
export function coerceIcon(value: unknown, key: string): CategoryIcon {
  return isCategoryIcon(value) ? value : fallbackIcon(key);
}
