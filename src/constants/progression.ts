import type {
  GainCategory,
  JourneyRole,
  ProgressionEvidenceRole,
  ProgressionMaturity,
} from '@/types';

export { phraseForMaturity, MATURITY_ORDER, maturityRank } from '@/ai/progressionRules';

/**
 * How settled a node is drawn (§28).
 *
 * Maturity decides how much light a node carries and nothing else. It is never
 * printed as a word, a number, a percentage or a size the eye can rank — §29
 * forbids the screen from feeling scored, and a progression that has only just
 * appeared is not worth less than one that has been around.
 */
export const MATURITY_OPACITY: Record<ProgressionMaturity, number> = {
  signal: 0.34,
  emerging: 0.55,
  evidenced: 0.78,
  established: 1,
};

/**
 * The Japanese gloss for a step on the PATH.
 *
 * Deliberately plain. None is praise or blame: friction reads as
 * 「ひっかかった」, not as a failure, because §10 counts it as evidence and
 * §30 forbids turning it into growth.
 */
export const EVIDENCE_ROLE_JA: Record<ProgressionEvidenceRole, string> = {
  origin: 'はじまり',
  attempt: '試した',
  friction: 'ひっかかった',
  adaptation: 'やり方を変えた',
  evidence: '記録',
  turning_point: '向きが変わった',
  current: 'いま',
};

export const JOURNEY_ROLE_JA: Record<JourneyRole, string> = {
  attempt: '試した',
  friction: 'ひっかかった',
  breakthrough: '通った',
  adaptation: 'やり方を変えた',
  learning: '分かった',
  turning_point: '向きが変わった',
  exploration: '見てまわった',
  continuation: '続けている',
  neutral: '起きたこと',
};

/**
 * What each kind of gain is, in the person's language (§20).
 *
 * Confidence is deliberately not here. §20: it is what someone feels after
 * seeing this evidence, not a category the app can hand them.
 */
export const GAIN_CATEGORY_JA: Record<GainCategory, string> = {
  evidence: '行動・経験した事実',
  method: '見つけた方法',
  insight: '自分や環境について分かったこと',
  connection: '生まれたつながり',
  criterion: '判断に使える基準',
  option: '新しく増えた可能性',
};

export const GAIN_CATEGORY_LABEL: Record<GainCategory, string> = {
  evidence: 'EVIDENCE',
  method: 'METHOD',
  insight: 'INSIGHT',
  connection: 'CONNECTION',
  criterion: 'CRITERION',
  option: 'OPTION',
};
