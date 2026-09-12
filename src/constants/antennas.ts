/**
 * Typed access to the アンテナ tree.
 *
 * The tree itself is generated from the preview. This module is the only place
 * that reads it, so the rest of the app never touches the generated shape.
 */
import { ANTENNAS, ANTENNA_ORDER, ANTENNA_WISH, ANTENNA_COLORS } from './generated/preview';
import type { AntennaId } from '@/types';

export interface AntennaCategory {
  id: string;
  antennaId: AntennaId;
  label: string;
  detailQuestion: string;
  details: { id: string; label: string }[];
}

const ALL: AntennaCategory[] = ANTENNA_ORDER.flatMap((antennaId) =>
  ANTENNAS[antennaId].categories.map((c) => ({
    id: c.id,
    antennaId,
    label: c.label,
    detailQuestion: c.detailQuestion,
    details: c.details.map((d) => ({ id: d.id, label: d.label })),
  }))
);

const BY_ID = new Map(ALL.map((c) => [c.id, c]));

export const ALL_ANTENNAS = ANTENNA_ORDER.map((id) => ({
  id,
  shortLabel: ANTENNAS[id].shortLabel,
  title: ANTENNAS[id].title,
  wish: ANTENNA_WISH[id],
  color: ANTENNA_COLORS[id],
  recommendedWhen: ANTENNAS[id].recommendedWhen,
  provides: ANTENNAS[id].provides,
}));

export function antenna(id: AntennaId) {
  return ALL_ANTENNAS.find((a) => a.id === id);
}

/**
 * The categories offered while writing, given the month's アンテナ.
 *
 * A month with no direction set still offers every category: not having
 * chosen what to watch is not a reason to be unable to write anything down.
 */
export function categoriesForMonth(antennaIds: readonly AntennaId[]): AntennaCategory[] {
  if (antennaIds.length === 0) return ALL;
  const wanted = new Set(antennaIds);
  return ALL.filter((c) => wanted.has(c.antennaId));
}

export function categoryById(id: string): AntennaCategory | undefined {
  return BY_ID.get(id);
}

export function detailsFor(categoryId: string) {
  return BY_ID.get(categoryId)?.details ?? [];
}

export { ANTENNA_ORDER };
