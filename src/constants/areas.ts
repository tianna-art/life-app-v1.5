import type { DirectionAreaId } from '@/types';

/**
 * The ten directions offered at the start of a year (§2).
 *
 * Several may be true at once, and that is the point: a person wanting a
 * different way of working usually also wants a few other things, and forcing
 * one goal would flatten what the reading can see later.
 *
 * `まだ分からない` is a real answer and sits with the rest rather than below
 * them. Someone who picks only that still gets a lens — a wide one.
 */
export interface DirectionArea {
  id: DirectionAreaId;
  label: string;
  /** Phrases the model uses when writing lenses. Never shown. */
  reads: string[];
}

export const DIRECTION_AREAS: readonly DirectionArea[] = [
  {
    id: 'own_way_of_working',
    label: '自分に合う働き方を見つけたい',
    reads: ['働き方', '環境', '合う条件', '合わない条件'],
  },
  {
    id: 'own_name_and_taste',
    label: '自分の名前・感性で仕事をしたい',
    reads: ['自分の感性', '自分の名前', '外に出す'],
  },
  {
    id: 'expertise',
    label: '専門性をつくりたい',
    reads: ['深める', '積み重ね', '専門'],
  },
  {
    id: 'own_axis',
    label: '自分の軸で決められるようになりたい',
    reads: ['自分で決める', '基準', '選ぶ'],
  },
  {
    id: 'proof_i_can',
    label: '「自分ならできる」という証拠を増やしたい',
    reads: ['やってみた', '初めて', '実績'],
  },
  {
    id: 'move_somewhere_new',
    label: '新しい場所へ動きたい',
    reads: ['移る', '新しい場所', '応募'],
  },
  {
    id: 'connections',
    label: '人とのつながりを育てたい',
    reads: ['人', '相談', '一緒に'],
  },
  {
    id: 'beyond_work',
    label: '仕事以外の大切なものも育てたい',
    reads: ['仕事以外', '暮らし', '自分の時間'],
  },
  {
    id: 'rebuild',
    label: '一度止まったところから立て直したい',
    reads: ['止まった', '戻る', 'もう一度'],
  },
  {
    id: 'not_sure_yet',
    label: 'まだ分からない',
    reads: [],
  },
] as const;

/** §2 caps the selection so the lens stays a lens rather than a checklist. */
export const MAX_AREAS = 4;

const BY_ID = new Map(DIRECTION_AREAS.map((a) => [a.id, a]));

export function directionAreaLabel(id: DirectionAreaId): string {
  return BY_ID.get(id)?.label ?? '';
}

export function isDirectionArea(value: unknown): value is DirectionAreaId {
  return typeof value === 'string' && BY_ID.has(value);
}

/** The phrases behind a selection, for the lens prompt. */
export function readsForAreas(ids: readonly DirectionAreaId[]): string[] {
  const out = new Set<string>();
  for (const id of ids) for (const read of BY_ID.get(id)?.reads ?? []) out.add(read);
  return [...out];
}
