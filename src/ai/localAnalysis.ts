/**
 * The no-model path.
 *
 * Runs when the project has no Supabase configuration (local development) or
 * when the Edge Function cannot be reached. It is deliberately meagre: it
 * counts and quotes, and it never asserts anything the person did not write.
 * Where the shipped path reads meaning, this one mostly returns
 * `gain_status: "unresolved"` — which the spec allows and the UI handles.
 */
import type {
  EntryAnalysis,
  EntryWithAnalysis,
  Gain,
  GainStatus,
  InputCategory,
  JourneyRole,
} from '@/types';
import { clampMaturity, clampStatus, maturityCeiling, type EvidenceSummary } from './gainRules';

const STOPWORDS = new Set([
  'こと', 'もの', 'それ', 'これ', 'ため', 'よう', 'そう', 'した', 'して', 'ある', 'いる',
  'なる', 'から', 'まで', 'ない', 'でも', 'たい', 'です', 'ます', 'today', 'the', 'and', 'for',
]);

/** Naive segmentation: kanji/katakana runs and latin words. */
export function extractTerms(text: string): string[] {
  const matches = text.match(/[一-鿿]{2,}|[゠-ヿ]{2,}|[A-Za-z]{3,}/g) ?? [];
  return matches.map((m) => m.trim()).filter((m) => m.length > 1 && !STOPWORDS.has(m));
}

const SETBACK_MARKERS = ['できなかった', 'うまくいかな', '失敗', '伝わらな', '反応がな', 'ダメ'];
const ADAPT_MARKERS = ['変えた', 'やめた', '切り替え', '試しに', '次は'];
const ATTEMPT_MARKERS = ['はじめて', '初めて', 'やってみ', '出した', '応募', '公開', '見せた'];
const LEARNING_MARKERS = ['分かった', 'わかった', '気づい', '知った'];

/**
 * Role from the drawer plus surface markers. `friction` defaults to setback
 * because that is what the person said it was — not because the text was read.
 */
export function localJourneyRole(inputCategory: InputCategory, body: string): JourneyRole {
  const has = (markers: string[]) => markers.some((m) => body.includes(m));
  if (has(ADAPT_MARKERS)) return 'adaptation';
  if (has(LEARNING_MARKERS)) return 'learning';
  if (inputCategory === 'friction') return has(SETBACK_MARKERS) ? 'setback' : 'neutral';
  if (inputCategory === 'progress') return has(ATTEMPT_MARKERS) ? 'attempt' : 'attempt';
  return 'neutral';
}

/** First clause of the entry, capped — a quotation, not a summary. */
export function localEventSummary(body: string, max = 40): string {
  const firstClause = body.split(/[。\n！？!?]/)[0]?.trim() ?? body.trim();
  const chars = Array.from(firstClause);
  return chars.length <= max ? firstClause : `${chars.slice(0, max).join('')}…`;
}

export interface LocalAnalysisInput {
  logId: string;
  inputCategory: InputCategory;
  body: string;
  occurredAt: string;
  /** Everything already written, newest first. Used only to count repeats. */
  history: readonly EntryWithAnalysis[];
}

export interface LocalGainDraft {
  type: Gain['type'];
  label: string;
  maturity: Gain['maturity'];
  confidence: number;
  evidence: string;
  /** Entries that already carried the same term. */
  supportingLogIds: string[];
}

export interface LocalAnalysisResult {
  analysis: EntryAnalysis;
  gains: LocalGainDraft[];
}

export function analyzeLocally(input: LocalAnalysisInput): LocalAnalysisResult {
  const terms = extractTerms(input.body);
  const semanticTags = [...new Set(terms.map((t) => t.toLowerCase()))].slice(0, 6);
  const journeyRole = localJourneyRole(input.inputCategory, input.body);
  const eventSummary = localEventSummary(input.body);

  const gains: LocalGainDraft[] = [];

  // A term the person has now used in more than one entry is the only pattern
  // this path is willing to name, and it is named as a direction, not a skill.
  const repeats = new Map<string, string[]>();
  for (const term of new Set(terms)) {
    const ids = input.history
      .filter((e) => e.id !== input.logId && e.body.includes(term))
      .map((e) => e.id);
    if (ids.length > 0) repeats.set(term, ids);
  }

  const strongest = [...repeats.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  )[0];

  if (strongest) {
    const [term, supportingLogIds] = strongest;
    const summary: EvidenceSummary = {
      distinctLogCount: supportingLogIds.length + 1,
      spanDays: 0,
      hasContrast: false,
      roles: [journeyRole],
    };
    gains.push({
      type: 'direction',
      label: term,
      maturity: clampMaturity('emerging', summary),
      confidence: Math.min(0.5, 0.2 + supportingLogIds.length * 0.1),
      evidence: `「${term}」を含む記録が ${supportingLogIds.length + 1} 件あります。`,
      supportingLogIds,
    });
  }

  // Something that was actually done leaves a trace whether or not it worked.
  if (input.inputCategory === 'progress') {
    const summary: EvidenceSummary = {
      distinctLogCount: 1,
      spanDays: 0,
      hasContrast: false,
      roles: [journeyRole],
    };
    gains.push({
      type: 'evidence',
      // A gain label is a name, not a sentence: the map has room for a phrase.
      label: localEventSummary(input.body, 16),
      maturity: maturityCeiling(summary),
      confidence: 0.3,
      evidence: 'この記録に書かれている出来事そのものです。',
      supportingLogIds: [],
    });
  }

  const status: GainStatus = clampStatus(
    gains.length === 0 ? 'unresolved' : 'possible',
    gains.length === 0 ? 0 : 1 + (gains[0]?.supportingLogIds.length ?? 0)
  );

  return {
    analysis: {
      logId: input.logId,
      eventSummary,
      journeyRole,
      gainStatus: status,
      semanticTags,
      analyzedAt: new Date().toISOString(),
    },
    gains,
  };
}
