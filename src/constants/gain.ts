import type { GainMaturity, GainType, JourneyRole } from '@/types';

/** Display order of the six gain types on the map and in the archive (§2). */
export const GAIN_TYPES: readonly GainType[] = [
  'capability',
  'insight',
  'strategy',
  'direction',
  'connection',
  'evidence',
] as const;

export const GAIN_TYPE_LABEL: Record<GainType, string> = {
  capability: 'CAPABILITY',
  insight: 'INSIGHT',
  strategy: 'STRATEGY',
  direction: 'DIRECTION',
  connection: 'CONNECTION',
  evidence: 'EVIDENCE',
};

/** The Japanese gloss, shown under the plate on the detail sheet only. */
export const GAIN_TYPE_JA: Record<GainType, string> = {
  capability: '身についた力',
  insight: '分かったこと',
  strategy: '新しく得たやり方',
  direction: '分かってきた方向',
  connection: '増えたつながり',
  evidence: '形として残ったもの',
};

export const GAIN_MATURITY_ORDER: readonly GainMaturity[] = [
  'signal',
  'attempt',
  'emerging',
  'evidenced',
  'established',
] as const;

export function maturityRank(maturity: GainMaturity): number {
  const index = GAIN_MATURITY_ORDER.indexOf(maturity);
  return index === -1 ? 0 : index;
}

/** Higher maturity wins. Used when a gain is seen again (§3). */
export function maxMaturity(a: GainMaturity, b: GainMaturity): GainMaturity {
  return maturityRank(a) >= maturityRank(b) ? a : b;
}

/**
 * How settled a node is drawn. Maturity is never printed as a word or a
 * number on the map — it only decides how much light a node carries (§23).
 */
export const MATURITY_OPACITY: Record<GainMaturity, number> = {
  signal: 0.32,
  attempt: 0.46,
  emerging: 0.62,
  evidenced: 0.82,
  established: 1,
};

export const JOURNEY_ROLE_JA: Record<JourneyRole, string> = {
  attempt: '試した',
  setback: 'うまくいかなかった',
  breakthrough: '通った',
  adaptation: 'やり方を変えた',
  learning: '分かった',
  turning_point: '向きが変わった',
  neutral: '起きたこと',
};

export function isGainType(value: unknown): value is GainType {
  return typeof value === 'string' && (GAIN_TYPES as readonly string[]).includes(value);
}

export function isGainMaturity(value: unknown): value is GainMaturity {
  return typeof value === 'string' && (GAIN_MATURITY_ORDER as readonly string[]).includes(value);
}
