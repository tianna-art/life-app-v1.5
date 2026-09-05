/**
 * The offline reading.
 *
 * No model, no network. It exists so a person with no connection — or a
 * project with no Supabase at all — still keeps their record and still sees
 * the app behave the way it promises: a dot on day one, and a line only once
 * there are enough dots to draw one.
 *
 * It is deliberately timid. Where the model would infer, this guesses from
 * surface overlap, so it stops at `signal` and `emerging` and never claims a
 * before-and-after it cannot point at. That is the correct failure mode: a
 * quiet map is honest, an invented trajectory is not.
 */
import type {
  EntryAnalysis,
  EntrySignals,
  EntryType,
  EntryWithAnalysis,
  JourneyRole,
  ProgressionEvidenceRole,
  ProgressionType,
  SubjectiveSignal,
} from '@/types';
import { emptySignals, normalizeTitle } from './progressionRules';

export interface LocalProgressionDraft {
  type: ProgressionType;
  title: string;
  summary: string;
  fromState?: string | undefined;
  currentState?: string | undefined;
  confidence: number;
  /** The earlier records this rests on, plus the entry just written. */
  evidence: { logId: string; role: ProgressionEvidenceRole; occurredAt: string }[];
}

export interface LocalAnalysisResult {
  analysis: EntryAnalysis;
  /** Empty on day one, and empty whenever nothing overlaps (§31). */
  progressions: LocalProgressionDraft[];
}

export interface LocalAnalysisInput {
  logId: string;
  type: EntryType;
  body: string;
  subjectiveSignal: SubjectiveSignal;
  occurredAt: string;
  /** Everything already written, newest first. */
  history: readonly EntryWithAnalysis[];
}

// ---------------------------------------------------------------------------
// Surface extraction
// ---------------------------------------------------------------------------

/**
 * Words that carry no topic. Japanese particles and the handful of verbs that
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
  'today',
  'the',
  'and',
  'was',
  'for',
]);

/**
 * Character bigrams for CJK, whole words for Latin.
 *
 * A real tokenizer is not available offline and is not worth shipping for a
 * fallback path; bigram overlap is crude but it is stable, and it errs towards
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

/** Phrases that hint at each kind of movement. Weak on purpose. */
const SIGNAL_HINTS: Record<ProgressionType, readonly string[]> = {
  capability: ['できた', 'できる', '初めて', '一人で', '覚え', '慣れ'],
  strategy: ['やり方', '方法', '変えて', '試し', '手順', 'かわりに'],
  interest: ['楽し', '面白', '気になる', '惹か', '好き', 'もっと'],
  direction: ['やりたい', '向いて', '目指', '進みたい', '辞め', '選び'],
  relationship: ['人に', 'friend', '友', '相談', '一緒', 'チーム', '見せ'],
  perspective: ['かもしれない', '思ってい', '気づ', '見方', '実は', 'そもそも'],
};

function readSignals(body: string): EntrySignals {
  const out = emptySignals();
  for (const [type, hints] of Object.entries(SIGNAL_HINTS) as [
    ProgressionType,
    readonly string[],
  ][]) {
    for (const hint of hints) {
      if (body.includes(hint)) out[type].push(hint);
    }
  }
  return out;
}

/**
 * The role one record plays, from what the person told us rather than from
 * what a model inferred.
 *
 * A thought is not an attempt; an event that went badly is a setback, not a
 * failure. Where the two inputs say nothing in particular, so does this.
 */
function readJourneyRole(type: EntryType, signal: SubjectiveSignal, body: string): JourneyRole {
  if (type === 'thought') {
    if (/かもしれない|気づ|そもそも|実は/.test(body)) return 'learning';
    if (signal === 'negative') return 'setback';
    return 'exploration';
  }
  if (/初めて|はじめて/.test(body)) return 'attempt';
  if (/試し|やってみ/.test(body)) return 'attempt';
  if (/変えて|かわりに|やめて/.test(body)) return 'adaptation';
  if (signal === 'negative') return 'setback';
  if (signal === 'positive') return 'breakthrough';
  return 'continuation';
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** How much overlap counts as "the same thread" offline. */
const MIN_SHARED_TERMS = 2;
/** §9: two records minimum, so one record never produces a line. */
const MIN_EVIDENCE = 2;

function summarise(body: string): string {
  const firstLine = body.split(/\n/)[0] ?? body;
  return firstLine.trim().slice(0, 80);
}

function roleToEvidenceRole(role: JourneyRole): ProgressionEvidenceRole {
  switch (role) {
    case 'attempt':
      return 'attempt';
    case 'setback':
      return 'setback';
    case 'adaptation':
      return 'adaptation';
    case 'turning_point':
    case 'breakthrough':
      return 'turning_point';
    default:
      return 'evidence';
  }
}

/** Picks the type with the most hints; ties fall to the widest bucket. */
function dominantType(signals: EntrySignals): ProgressionType {
  let best: ProgressionType = 'perspective';
  let bestCount = 0;
  for (const type of Object.keys(signals) as ProgressionType[]) {
    const count = signals[type].length;
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

export function analyzeLocally(input: LocalAnalysisInput): LocalAnalysisResult {
  const terms = surfaceTerms(input.body);
  const signals = readSignals(input.body);
  const journeyRole = readJourneyRole(input.type, input.subjectiveSignal, input.body);

  const analysis: EntryAnalysis = {
    logId: input.logId,
    eventSummary: summarise(input.body),
    // Longest first: the longer bigrams read closer to real words.
    topics: [...terms].sort((a, b) => b.length - a.length).slice(0, 6),
    actors: [],
    environment: [],
    journeyRole,
    signals,
    // Never high: this path did not read the record, it matched strings on it.
    confidence: 0.3,
    analyzedAt: new Date().toISOString(),
  };

  const termSet = new Set(terms);
  const related = input.history
    .filter((entry) => entry.id !== input.logId)
    .map((entry) => {
      const shared = (entry.analysis?.topics ?? surfaceTerms(entry.body)).filter((t) =>
        termSet.has(t)
      );
      return { entry, shared: shared.length };
    })
    .filter((r) => r.shared >= MIN_SHARED_TERMS)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 4);

  // One record on its own is a dot, and stays a dot (§31).
  if (related.length + 1 < MIN_EVIDENCE) {
    return { analysis, progressions: [] };
  }

  const title = normalizeTitle(analysis.topics[0] ?? '').slice(0, 24);
  if (title.length === 0) return { analysis, progressions: [] };

  const evidence: LocalProgressionDraft['evidence'] = [
    ...related.map((r) => ({
      logId: r.entry.id,
      role: roleToEvidenceRole(r.entry.analysis?.journeyRole ?? 'neutral'),
      occurredAt: r.entry.occurredAt,
    })),
    { logId: input.logId, role: 'current' as const, occurredAt: input.occurredAt },
  ];

  return {
    analysis,
    progressions: [
      {
        type: dominantType(signals),
        title,
        // No claim about direction: this path cannot see one, so it says only
        // that the records are related, and the maturity ceiling does the rest.
        summary: '',
        confidence: 0.3,
        evidence,
      },
    ],
  };
}
