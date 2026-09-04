import type { CategoryInput } from '@/types';

/**
 * Initial categories (spec §3.4). These are drawers the user chooses from,
 * NOT diagnostic axes: they are seeded per user and fully editable afterwards.
 */
export interface DefaultCategorySeed extends CategoryInput {
  slug: string;
  name: string;
  promptExamples: string[];
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  {
    slug: 'tokimeki',
    name: 'ときめき',
    promptExamples: [
      '今日ちょっと「いいな」と思ったことは？',
      'つい時間を使ってしまったものは？',
      'また触れたいと思ったものは？',
    ],
  },
  {
    slug: 'tsumiage',
    name: '積み上げ',
    promptExamples: [
      '今日、少しでも手を動かしたことは？',
      '小さく前に進んだと思えることは？',
      '昨日までより少しできたことは？',
    ],
  },
  {
    slug: 'kyokun',
    name: '教訓',
    promptExamples: [
      '今日の出来事から「次はこうしてみよう」と思ったことは？',
      '次回は少し変えてみたいことは？',
      '今日わかった「こうすると良さそう」は？',
    ],
  },
  {
    slug: 'hikkakari',
    name: 'ひっかかり',
    promptExamples: [
      '今日、少し引っかかったことは？',
      'ちょっと悔しかったことは？',
      '「なんか違う」と感じたことは？',
    ],
  },
  {
    slug: 'kankeisei',
    name: '関係性',
    promptExamples: [
      '今日、誰かとのやりとりで心地よかった / しんどかったことは？',
      'どんな関わり方だと自分は力を出しやすかった？',
      '誰といる時、自然に動けた？',
    ],
  },
  {
    slug: 'sonota',
    name: 'その他',
    promptExamples: ['今残しておきたいことは？'],
  },
];

/** Fallback prompt for user-created categories with no examples of their own. */
export const GENERIC_PROMPT = '今残しておきたいことは？';

/** Deterministic-by-seed random pick, so tests can pin the result. */
export function pickPrompt(prompts: string[], seed = Math.random()): string {
  if (prompts.length === 0) return GENERIC_PROMPT;
  const index = Math.min(prompts.length - 1, Math.floor(seed * prompts.length));
  return prompts[index] ?? GENERIC_PROMPT;
}
