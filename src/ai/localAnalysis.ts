/**
 * The offline reading.
 *
 * No model, no network. It exists so a person with no connection — or a
 * project with no Supabase at all — still keeps their record and still sees
 * the app behave the way it promises: a dot on day one, and a line only once
 * there are enough dots to draw one.
 *
 * v4 makes this path much stronger than it was, and for a structural reason:
 * Level 1 and Level 2 are the person's own evidence (§16), so the patterns in
 * §17 can be checked without reading a single word. `patternSatisfied` does
 * the work, and what remains for the model is naming — which is exactly the
 * part this file declines to guess at.
 */
import type {
  LogAnalysis,
  CategoryId,
  LogWithAnalysis,
  ProgressionEvidenceRole,
  ProgressionPattern,
  ProgressionType,
} from '@/types';
import { patternSatisfied, satisfiedPatterns } from './progressionRules';

export interface LocalProgressionDraft {
  type: ProgressionType;
  pattern: ProgressionPattern;
  title: string;
  summary: string;
  confidence: number;
  goalExternal: boolean;
  evidence: { logId: string; role: ProgressionEvidenceRole; occurredAt: string }[];
}

export interface LocalAnalysisResult {
  analysis: LogAnalysis;
  /** Empty on day one, and empty whenever no pattern is actually shown. */
  progressions: LocalProgressionDraft[];
}

export interface LocalAnalysisInput {
  logId: string;
  categoryId: CategoryId;
  body?: string | undefined;
  occurredAt: string;
  /** Everything already written, any order. */
  history: readonly LogWithAnalysis[];
}

// ---------------------------------------------------------------------------
// Surface extraction
// ---------------------------------------------------------------------------

/**
 * Words that carry no theme. Japanese particles and the handful of verbs that
 * appear in almost every sentence — keeping them would make every record look
 * related to every other one.
 */
const STOP = new Set([
  'した',
  'して',
  'する',
  'いる',
  'ある',
  'こと',
  'もの',
  'それ',
  'これ',
  'ため',
  'よう',
  'とき',
  'ない',
  'なっ',
  'なる',
  'から',
  'まで',
  'ので',
  'けど',
  'でも',
  'the',
  'and',
  'was',
  'for',
]);

/**
 * Character bigrams for CJK, whole words for Latin.
 *
 * A real tokenizer is not available offline and is not worth shipping for a
 * fallback path; bigram overlap is crude but stable, and it errs towards
 * finding nothing rather than finding a false connection.
 */
export function surfaceTerms(text: string): string[] {
  const normalized = text.normalize('NFKC').toLowerCase();
  const out = new Set<string>();

  for (const word of normalized.match(/[a-z][a-z0-9'-]{2,}/g) ?? []) {
    if (!STOP.has(word)) out.add(word);
  }

  const cjk = normalized.replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu, ' ');
  for (const run of cjk.split(/\s+/)) {
    if (run.length < 2) continue;
    for (let i = 0; i < run.length - 1; i += 1) {
      const gram = run.slice(i, i + 2);
      if (!STOP.has(gram)) out.add(gram);
    }
  }

  return [...out];
}

// ---------------------------------------------------------------------------
// Reading one record
// ---------------------------------------------------------------------------

/** Which type of progression a pattern most naturally belongs to. */
const TYPE_FOR_PATTERN: Record<ProgressionPattern, ProgressionType> = {
  naming: 'perspective',
  first_act: 'capability',
  repeat: 'capability',
  solo: 'capability',
  pivot: 'strategy',
  expose: 'relationship',
  own_call: 'direction',
  transfer: 'strategy',
  reframe: 'perspective',
  boundary: 'direction',
};

/** What a record does in a path, read from what the person tapped. */
function evidenceRole(categoryId: CategoryId | undefined): ProgressionEvidenceRole {
  switch (categoryId) {
    case 'self_hard':
      return 'friction';
    case 'sustainable_relieved':
      return 'adaptation';
    case 'values_important':
    case 'values_wrong':
    case 'progress_learned':
      return 'turning_point';
    case 'progress_tried':
    case 'progress_did':
      return 'attempt';
    case 'spark_curious':
    case 'spark_inspired':
      return 'origin';
    default:
      return 'evidence';
  }
}

export function analyzeLocally(input: LocalAnalysisInput): LocalAnalysisResult {
  const answer = input.body?.trim() ?? '';
  const terms = answer.length > 0 ? surfaceTerms(answer) : [];

  const analysis: LogAnalysis = {
    logId: input.logId,
    // With no free text there is nothing to summarise, and inventing a
    // sentence from the tags would put words in the person's mouth. The screen
    // falls back to the tag names, which are theirs.
    eventSummary: answer.slice(0, 80),
    themes: [...terms].sort((a, b) => b.length - a.length).slice(0, 6),
    people: [],
    // Only the fields the tags themselves assert. Nothing is inferred.
    // Only what the category itself asserts. Nothing is inferred: 「しんどか
    // った」 is friction because the person said so, and nothing else here
    // reads a feeling into a line they wrote.
    ...(input.categoryId === 'self_hard' && answer ? { friction: answer.slice(0, 120) } : {}),
    ...(input.categoryId === 'progress_learned' && answer
      ? { discovery: answer.slice(0, 120) }
      : {}),
    ...(input.categoryId === 'sustainable_relieved' && answer
      ? { adaptation: answer.slice(0, 120) }
      : {}),
    ...(input.categoryId === 'values_important' && answer ? { choice: answer.slice(0, 120) } : {}),
    // Never high: this path matched strings, it did not read anything.
    confidence: 0.3,
    analyzedAt: new Date().toISOString(),
  };

  // What the record might belong with. With free text, shared terms decide.
  //
  // Without it, everything recent is offered and the pattern floors do the
  // discriminating — which is what they are for. This used to pre-filter on
  // the door the record came through, and that was arbitrary work: a shape
  // like しんどかった → 楽になった → やってみた crosses three categories by
  // definition, so a filter that keeps only records like this one can never
  // find it. Narrowing before the floor runs does not make the answer safer;
  // it makes it smaller.
  const termSet = new Set(terms);
  const related = input.history
    .filter((log) => log.id !== input.logId)
    .filter((log) => {
      if (termSet.size === 0) return true;
      const theirs = log.analysis?.themes ?? surfaceTerms(log.body ?? log.optionalAnswer ?? '');
      // Shared words are a stronger signal than proximity, so when there are
      // any, they decide — but a record with none is not excluded by them.
      return theirs.length === 0 || theirs.filter((t) => termSet.has(t)).length >= 2;
    })
    .slice(-8);

  const evidence = [
    ...related.map((log) => ({
      logId: log.id,
      ...(log.categoryId ? { categoryId: log.categoryId } : {}),
      occurredAt: log.occurredAt,
    })),
    {
      logId: input.logId,
      categoryId: input.categoryId,
      occurredAt: input.occurredAt,
    },
  ];

  // The patterns these records actually show. No pattern, no progression —
  // §18's floor, applied without a model.
  const shown = satisfiedPatterns(evidence).filter((p) => patternSatisfied(p, evidence));
  if (shown.length === 0) return { analysis, progressions: [] };

  const pattern = shown[0] as ProgressionPattern;
  // The title is the one thing this path cannot produce honestly: naming a
  // movement in the person's own words is the model's job (§22). Falling back
  // to the answer's own words is the closest available truth.
  const title = answer.slice(0, 20).trim();
  if (title.length === 0) return { analysis, progressions: [] };

  return {
    analysis,
    progressions: [
      {
        type: TYPE_FOR_PATTERN[pattern],
        pattern,
        title,
        // No claim about direction: this path cannot see one, and the maturity
        // ceiling does the rest.
        summary: '',
        confidence: 0.3,
        goalExternal: false,
        evidence: evidence.map((e) => ({
          logId: e.logId,
          role: evidenceRole(e.categoryId as CategoryId | undefined),
          occurredAt: e.occurredAt,
        })),
      },
    ],
  };
}
