import type { ProgressionMaturity, ProgressionEvidenceRole, JourneyRole } from '@/types';

export { phraseForMaturity, MATURITY_ORDER, maturityRank } from '@/ai/progressionRules';

/**
 * How settled a node is drawn (§20).
 *
 * Maturity decides how much light a node carries and nothing else. It is never
 * printed as a word, a number, a percentage or a size the eye can rank — §19
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
 * The Japanese gloss for a step on the HOW IT CHANGED path.
 *
 * Deliberately plain. None of these is praise or blame: a setback reads as
 * "うまくいかなかった", not as a failure, because §2 counts it as movement.
 */
export const EVIDENCE_ROLE_JA: Record<ProgressionEvidenceRole, string> = {
  origin: 'はじまり',
  attempt: '試した',
  setback: 'うまくいかなかった',
  adaptation: 'やり方を変えた',
  evidence: '記録',
  turning_point: '向きが変わった',
  current: 'いま',
};

export const JOURNEY_ROLE_JA: Record<JourneyRole, string> = {
  attempt: '試した',
  setback: 'うまくいかなかった',
  breakthrough: '通った',
  adaptation: 'やり方を変えた',
  learning: '分かった',
  turning_point: '向きが変わった',
  exploration: '見てまわった',
  continuation: '続けている',
  neutral: '起きたこと',
};
