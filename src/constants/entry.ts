import type { EntryType, SubjectiveSignal } from '@/types';

/**
 * The two drawers (§3).
 *
 * Not a taxonomy the person maintains, and not a judgement: an event is what
 * happened, a thought is what passed through. Anything that does not obviously
 * belong in one belongs in the other, and nothing is lost either way.
 */
export interface EntryTypeDef {
  id: EntryType;
  label: string;
  covers: string[];
}

export const ENTRY_TYPES: readonly EntryTypeDef[] = [
  {
    id: 'event',
    label: '出来事',
    covers: ['実際に起きたこと', 'やったこと', '経験したこと'],
  },
  {
    id: 'thought',
    label: 'つぶやき',
    covers: ['考えたこと', '感じたこと', '違和感', '発見', '仮説'],
  },
] as const;

/**
 * The signal (§3).
 *
 * Shown as three marks and nothing else. The words below exist for the screen
 * reader and the prompt; they are never printed beside the marks, because a
 * legend would turn one tap into a decision.
 */
export interface SignalDef {
  id: SubjectiveSignal;
  mark: string;
  /** Accessibility label only. Never rendered as visible text. */
  hint: string;
}

export const SIGNALS: readonly SignalDef[] = [
  { id: 'positive', mark: '＋', hint: '自分にとって良かった' },
  { id: 'mixed', mark: '±', hint: 'どちらとも言えない' },
  { id: 'negative', mark: '−', hint: '自分にとってしんどかった' },
] as const;

const TYPE_BY_ID = new Map(ENTRY_TYPES.map((t) => [t.id, t]));
const SIGNAL_BY_ID = new Map(SIGNALS.map((s) => [s.id, s]));

export function entryTypeLabel(id: EntryType): string {
  return TYPE_BY_ID.get(id)?.label ?? '';
}

export function signalMark(id: SubjectiveSignal): string {
  return SIGNAL_BY_ID.get(id)?.mark ?? '';
}

export function signalHint(id: SubjectiveSignal): string {
  return SIGNAL_BY_ID.get(id)?.hint ?? '';
}

export function isEntryType(value: unknown): value is EntryType {
  return typeof value === 'string' && TYPE_BY_ID.has(value as EntryType);
}

export function isSubjectiveSignal(value: unknown): value is SubjectiveSignal {
  return typeof value === 'string' && SIGNAL_BY_ID.has(value as SubjectiveSignal);
}

/**
 * v2 chips mapped onto the two drawers, for records written before this
 * release. Matched on the stored id; the body is never touched.
 */
export function entryTypeForLegacyCategory(category: string | null | undefined): EntryType {
  return category === 'moved' ? 'thought' : 'event';
}
