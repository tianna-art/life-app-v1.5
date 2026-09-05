import type { DesiredSelfCardId, ProgressionPattern } from '@/types';

/**
 * "どんな自分になれたら嬉しい？" (§3).
 *
 * These are not tasks and there is no upper limit: someone may take one card
 * or twenty. What they are is a sensor setting — each card raises the
 * detection priority of particular patterns, so a person who wants to show
 * their ideas to people gets FIRST-ACT and EXPOSE watched more closely than
 * someone who does not (§19).
 *
 * The list is data so it can grow without touching the reading (§3). Ids are
 * stored in the database and must never be renamed.
 */
export interface DesiredSelfGroup {
  id: string;
  /** Shown as a quiet plate above the cards. */
  label: string;
  cards: readonly DesiredSelfCard[];
}

export interface DesiredSelfCard {
  id: DesiredSelfCardId;
  label: string;
  /** Patterns this card makes worth looking for. Never shown. */
  watches: readonly ProgressionPattern[];
}

export const DESIRED_SELF_GROUPS: readonly DesiredSelfGroup[] = [
  {
    id: 'do',
    label: 'DO',
    cards: [
      { id: 'do_try_not_just_think', label: '考えるだけでなく試せる', watches: ['first_act'] },
      { id: 'do_make_ideas_real', label: 'アイデアを形にできる', watches: ['first_act', 'repeat'] },
      { id: 'do_first_step_fast', label: '最初の一歩を早く出せる', watches: ['first_act'] },
      { id: 'do_build_while_showing', label: '人に見せながら作れる', watches: ['expose'] },
      { id: 'do_more_than_once', label: '一度で終わらず何度か試せる', watches: ['repeat'] },
      { id: 'do_another_way', label: '失敗しても別の方法を試せる', watches: ['pivot'] },
    ],
  },
  {
    id: 'know',
    label: 'KNOW',
    cards: [
      { id: 'know_what_i_like', label: '自分の好きなことが分かる', watches: ['naming'] },
      { id: 'know_what_im_good_at', label: '自分の得意が分かる', watches: ['naming'] },
      { id: 'know_bad_environments', label: '苦手な環境が分かる', watches: ['naming', 'boundary'] },
      { id: 'know_when_i_have_energy', label: '力が出る条件が分かる', watches: ['naming'] },
      { id: 'know_what_matters', label: '自分が大切にしたいことが分かる', watches: ['naming', 'reframe'] },
      { id: 'know_next_direction', label: '次に向かいたい方向が分かる', watches: ['naming', 'reframe'] },
    ],
  },
  {
    id: 'choose',
    label: 'CHOOSE',
    cards: [
      { id: 'choose_decide_myself', label: '自分で決められる', watches: ['own_call'] },
      { id: 'choose_decline', label: '合わないものを断れる', watches: ['boundary'] },
      { id: 'choose_not_to_do', label: 'やらないことを選べる', watches: ['boundary'] },
      { id: 'choose_without_comparing', label: '他人と比較せず選べる', watches: ['own_call'] },
      { id: 'choose_change_direction', label: '方向転換できる', watches: ['pivot', 'reframe'] },
      { id: 'choose_with_conviction', label: '納得して選べる', watches: ['own_call'] },
    ],
  },
  {
    id: 'express',
    label: 'EXPRESS',
    cards: [
      { id: 'express_say_my_thoughts', label: '自分の考えを言える', watches: ['expose'] },
      { id: 'express_show_ideas', label: '人にアイデアを見せられる', watches: ['first_act', 'expose'] },
      { id: 'express_publish_work', label: '自分の作品を外に出せる', watches: ['expose'] },
      { id: 'express_to_strangers', label: '初対面の人にも説明できる', watches: ['expose', 'repeat'] },
      { id: 'express_under_my_name', label: '自分の名前で何かできる', watches: ['expose', 'own_call'] },
    ],
  },
  {
    id: 'connect',
    label: 'CONNECT',
    cards: [
      { id: 'connect_ask_advice', label: '相談できる', watches: ['expose'] },
      { id: 'connect_ask_for_help', label: '助けを求められる', watches: ['expose'] },
      { id: 'connect_try_together', label: '一緒に挑戦できる人がいる', watches: ['expose', 'repeat'] },
      { id: 'connect_be_myself', label: '自分らしくいられる人がいる', watches: ['naming'] },
      { id: 'connect_widen_world', label: '自分の世界を広げてくれる人と出会う', watches: ['naming'] },
    ],
  },
  {
    id: 'live',
    label: 'LIVE',
    cards: [
      { id: 'live_more_fun', label: '楽しい時間が増える', watches: ['repeat', 'naming'] },
      { id: 'live_absorbed_in_something', label: '夢中になれるものがある', watches: ['repeat'] },
      { id: 'live_protect_my_time', label: '自分の時間を守れる', watches: ['boundary'] },
      { id: 'live_beyond_work', label: '仕事以外にも大切なものがある', watches: ['naming'] },
      { id: 'live_be_moved', label: '心が動く経験を増やせる', watches: ['repeat', 'naming'] },
    ],
  },
] as const;

export const DESIRED_SELF_CARDS: readonly DesiredSelfCard[] = DESIRED_SELF_GROUPS.flatMap(
  (g) => g.cards
);

const BY_ID = new Map(DESIRED_SELF_CARDS.map((c) => [c.id, c]));

export function desiredSelfLabel(id: DesiredSelfCardId): string {
  return BY_ID.get(id)?.label ?? '';
}

export function isDesiredSelfCard(value: unknown): value is DesiredSelfCardId {
  return typeof value === 'string' && BY_ID.has(value);
}

/**
 * Which patterns the chosen cards make worth looking for.
 *
 * This raises priority; it never filters. A progression matching none of these
 * is still detected and still kept (§19) — the year's direction decides what
 * to look at first, not what is allowed to exist.
 */
export function watchedPatterns(
  ids: readonly DesiredSelfCardId[]
): ProgressionPattern[] {
  const out = new Set<ProgressionPattern>();
  for (const id of ids) for (const p of BY_ID.get(id)?.watches ?? []) out.add(p);
  return [...out];
}
