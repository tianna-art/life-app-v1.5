/**
 * Domain types for crincran.
 *
 * One sentence decides the shape of this file: the person leaves the dots, the
 * AI connects them. So an entry carries only what the person alone can know —
 * what happened, and how it landed for them — and everything interpretive
 * lives in rows the model writes beside it.
 *
 * The centre of the model is Progression, not Gain. A gain is what a
 * progression left behind (§22), so it hangs off one and is never the thing
 * that gets found first.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The one classification the person makes (§3). Neither option is a verdict. */
export type EntryType = 'event' | 'thought';

/** How it landed for them. Kept apart from the body: the two can disagree. */
export type SubjectiveSignal = 'positive' | 'mixed' | 'negative';

/** What kind of movement a progression is (§10). Internal — never on the map. */
export type ProgressionType =
  | 'capability'
  | 'strategy'
  | 'interest'
  | 'direction'
  | 'relationship'
  | 'perspective';

/**
 * How settled a progression is (§12). The wording the person reads is bound to
 * the rung, and the rung is bound to the evidence — not to what the model
 * would like to say.
 */
export type ProgressionMaturity = 'signal' | 'emerging' | 'evidenced' | 'established';

/** What one record does inside a progression (§11). */
export type ProgressionEvidenceRole =
  | 'origin'
  | 'attempt'
  | 'setback'
  | 'adaptation'
  | 'evidence'
  | 'turning_point'
  | 'current';

/** What one record is on its own (§7). `neutral` when confidence is low. */
export type JourneyRole =
  | 'attempt'
  | 'setback'
  | 'breakthrough'
  | 'adaptation'
  | 'learning'
  | 'turning_point'
  | 'exploration'
  | 'continuation'
  | 'neutral';

/** The whole feedback vocabulary (§28). Two options, nothing more. */
export type ProgressionVerdict = 'accepted' | 'adjusted';

// ---------------------------------------------------------------------------
// Entries — what the person leaves
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  userId: string;
  /** Full timestamp of the moment the entry belongs to. */
  occurredAt: string;
  /** `YYYY-MM-DD`, derived from occurredAt. Every period query joins on this. */
  occurredOn: string;
  type: EntryType;
  body: string;
  subjectiveSignal: SubjectiveSignal;
  createdAt: string;
}

export interface NewEntryInput {
  type: EntryType;
  body: string;
  subjectiveSignal: SubjectiveSignal;
  /** Defaults to now. */
  occurredAt?: string;
}

/**
 * Six buckets of weak evidence, each a few short phrases lifted from the body.
 * STAGE 2 matches on these; nothing here is ever shown to anyone.
 */
export type EntrySignals = Record<ProgressionType, string[]>;

/** What STAGE 1 read out of a single entry (§6). Never rendered as a form. */
export interface EntryAnalysis {
  logId: string;
  eventSummary: string;
  topics: string[];
  actors: string[];
  environment: string[];
  action?: string | undefined;
  outcome?: string | undefined;
  reaction?: string | undefined;
  hypothesis?: string | undefined;
  futureIntention?: string | undefined;
  journeyRole: JourneyRole;
  signals: EntrySignals;
  /** 0..1. Low confidence is allowed to stay low; it forces `neutral`. */
  confidence: number;
  analyzedAt?: string | undefined;
}

export interface EntryWithAnalysis extends JournalEntry {
  analysis?: EntryAnalysis | undefined;
  /** Progressions this entry stands inside. Present on detail reads. */
  progressions?: ProgressionRef[] | undefined;
}

/** Just enough of a progression to name it from an entry. */
export interface ProgressionRef {
  id: string;
  title: string;
  role: ProgressionEvidenceRole;
}

// ---------------------------------------------------------------------------
// Progressions — what the AI connects
// ---------------------------------------------------------------------------

export interface Progression {
  id: string;
  userId: string;
  type: ProgressionType;
  /** The person's own words (§17), never the type name. */
  title: string;
  fromState?: string | undefined;
  currentState?: string | undefined;
  summary: string;
  maturity: ProgressionMaturity;
  /** Internal ordering signal. Never rendered as a number (§19). */
  confidence: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  /** Set once the person has said 納得した / 少し違う. */
  verdict?: ProgressionVerdict | undefined;
  /** True once they rewrote it. Their wording then outranks the model's. */
  userEdited: boolean;
  /** Non-null when this was folded into a broader progression (§30). */
  mergedIntoId?: string | undefined;
  evidenceCount: number;
}

export interface ProgressionEvidence {
  id: string;
  progressionId: string;
  logId: string;
  role: ProgressionEvidenceRole;
  occurredAt: string;
}

/** One step on the HOW IT CHANGED path (§21), resolved for display. */
export interface ProgressionStep {
  logId: string;
  occurredOn: string;
  role: ProgressionEvidenceRole;
  /** The model's one-line reading of that record. */
  eventSummary: string;
  entryType: EntryType;
  subjectiveSignal: SubjectiveSignal;
}

/** What a progression left behind (§22). Output, never input. */
export interface Gain {
  id: string;
  progressionId: string;
  label: string;
  description?: string | undefined;
  confidence: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
}

/** A progression plus everything needed to explain it, loaded on tap. */
export interface ProgressionDetail {
  progression: Progression;
  /** Oldest first. */
  steps: ProgressionStep[];
  /** Empty when nothing has settled yet — which is the honest common case. */
  gains: Gain[];
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

/** One progression as it stood at the end of a given month (§24). */
export interface MonthProgression {
  progression: Progression;
  /** Ids of that month's entries that moved it. */
  evidenceLogIds: string[];
  /** True when the progression first appeared in this month. */
  isNew: boolean;
  /** Where it had got to by the end of that month, not where it is now. */
  maturityThen: ProgressionMaturity;
}

/** The month-end reading (§23). At most three, and never padded to three. */
export interface MonthReview {
  periodKey: string;
  /** `OUT INTO THE WORLD` */
  title: string;
  subtitle: string;
  progressions: MonthReviewProgression[];
  /** What the person is carrying forward. Empty when nothing has settled. */
  carryingForward: string;
  createdAt: string;
}

export interface MonthReviewProgression {
  title: string;
  /** `「自分の中だけで考える」から「人に見せながら考える」へ。` */
  line: string;
}

// ---------------------------------------------------------------------------
// Immediate response (§15)
// ---------------------------------------------------------------------------

/**
 * The short line shown right after a save.
 *
 * One entry never produces a progression, so this is deliberately small: the
 * one thing that can honestly be said about the record just written, and — if
 * it happened to land on an existing trail — that it did.
 */
export interface Mirror {
  logId: string;
  /** Empty when nothing could honestly be said. */
  line: string;
  /** Set when this entry joined a progression that already existed (§15). */
  joinedProgression?: { id: string; title: string } | undefined;
}

/** The optional one-tap question (§14). At most one, and always skippable. */
export interface Clarification {
  id: string;
  logId: string;
  question: string;
  options: string[];
  answer?: string | undefined;
}
