/**
 * The eval suite.
 *
 * Each golden is a way a reading has gone wrong — a card citing records that
 * were never written, one afternoon presented as a pattern, a bad month handed
 * back as a lesson — paired with what has to happen to it. Loosening a rule to
 * make a prompt easier fails here rather than in someone's month.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  acceptInsights,
  checkSummary,
  checkTitles,
  hypothesisIsHedged,
  mayOfferHypothesis,
  type ProposedInsight,
} from '@/ai/reading';
import type { AntennaId } from '@/types';

interface Goldens {
  insights: {
    name: string;
    logIds: string[];
    antennaIds: AntennaId[];
    proposed: ProposedInsight[];
    expect: { accepted: number; labels?: string[]; hypothesis: boolean };
  }[];
  hypotheses: { name: string; text: string; hedged: boolean }[];
  summaries: { name: string; keywords: string[]; body: string; ok: boolean }[];
  titles: { name: string; titles: string[]; ok: boolean }[];
}

const goldens = JSON.parse(
  readFileSync(join(__dirname, 'goldens.json'), 'utf8')
) as Goldens;

describe('見立てカード', () => {
  it.each(goldens.insights.map((g) => [g.name, g] as const))('%s', (_name, golden) => {
    const { accepted } = acceptInsights(golden.proposed, golden.logIds, golden.antennaIds);
    expect(accepted).toHaveLength(golden.expect.accepted);
    if (golden.expect.labels) {
      expect(accepted.map((card) => card.label)).toEqual(golden.expect.labels);
    }
    expect(mayOfferHypothesis(accepted)).toBe(golden.expect.hypothesis);
  });
});

describe('今の仮説 suggests rather than states', () => {
  it.each(goldens.hypotheses.map((g) => [g.name, g] as const))('%s', (_name, golden) => {
    expect(hypothesisIsHedged(golden.text)).toBe(golden.hedged);
  });
});

describe('月次サマリー', () => {
  it.each(goldens.summaries.map((g) => [g.name, g] as const))('%s', (_name, golden) => {
    const verdict = checkSummary(golden.keywords, golden.body);
    if (verdict.ok !== golden.ok) {
      throw new Error(
        `expected ok=${golden.ok}, got ok=${verdict.ok} — ${verdict.problems.join('; ')}`
      );
    }
  });
});

describe('足跡タイトル候補', () => {
  it.each(goldens.titles.map((g) => [g.name, g] as const))('%s', (_name, golden) => {
    expect(checkTitles(golden.titles).ok).toBe(golden.ok);
  });
});

describe('the suite itself', () => {
  it('covers every rule that can silently loosen', () => {
    // A golden file that quietly shrinks is the same failure as a rule that
    // quietly loosens, so its size is part of the contract.
    expect(goldens.insights.length).toBeGreaterThanOrEqual(8);
    expect(goldens.summaries.length).toBeGreaterThanOrEqual(5);
    expect(goldens.titles.length).toBeGreaterThanOrEqual(4);
    expect(goldens.hypotheses.length).toBeGreaterThanOrEqual(4);
  });
});
