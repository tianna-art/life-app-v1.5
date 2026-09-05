/**
 * Domain types for crincran.
 *
 * Four layers (§1), and the order between them is the product:
 *
 *   GAP / DIRECTION   what kind of person they want to become
 *   DAILY EVIDENCE    what actually happened
 *   PROGRESSION       what changed between those records
 *   GAIN              what is left over from that change
 *
 * The first layer is a lens, never a target. Nothing in this file records how
 * close anyone is to anything (§1, §19): a direction decides what the reading
 * looks for, and that is all it does.
 */

// ---------------------------------------------------------------------------
// Level 1 & 2 — what the person taps (§9, §10)
// ---------------------------------------------------------------------------

/** The door the record is left through. Not an exclusive classification. */
export type LogType = 'self_action' | 'relationship' | 'thought';

/**
 * What kind of moment it was. More than one may be true at once — "first time"
 * and "enjoyed" and "friction" can all describe the same afternoon.
 *
 * None of these is a verdict. `friction` in particular is not a failure and is
 * never read as one (§10).
 */
export type MomentTag =
  | 'enjoyed'
  | 'tried'
  | 'first_time'
  | 'friction'
  | 'changed'
  | 'discovered'
  | 'self_decided';

// ---------------------------------------------------------------------------
// The lens (§2-§5)
// ---------------------------------------------------------------------------

/** Which of the ten directions they want to grow this year. Ids, not prose. */
export type DirectionAreaId = string;

/** Which "I'd be glad to become this" cards they picked. Ids, not prose. */
export type DesiredSelfCardId = string;

export interface YearDirection {
  id: string;
  userId: string;
  year: number;
  selectedAreas: DirectionAreaId[];
  desiredSelfCards: DesiredSelfCardId[];
  /**
   * What the model decided to watch for, in the person's own vocabulary.
   * Read by STAGE 2 as detection priority; never written back to as a result.
   */
  progressionLenses: string[];
  /** Set at the start of the year, and left alone afterwards. */
  initialTheme?: string | undefined;
  /** Written at year end, next to — not over — the initial one (§26). */
  finalTheme?: string | undefined;
}

export type ThemeSource = 'continue' | 'deepen' | 'follow_spark' | 'custom' | 'none';

export interface MonthTheme {
  id: string;
  userId: string;
  year: number;
  month: number;
  initialTheme?: string | undefined;
  finalTheme?: string | undefined;
  source: ThemeSource;
  /** The three offered, kept so the month screen can show what was passed over. */
  candidates: MonthThemeCandidate[];
}

export interface MonthThemeCandidate {
  source: Exclude<ThemeSource, 'custom' | 'none'>;
  theme: string;
  /** One line saying which records it came from. Never a reason to comply. */
  because: string;
}

// ---------------------------------------------------------------------------
// Daily evidence
// ---------------------------------------------------------------------------

export interface DailyLog {
  id: string;
  userId: string;
  occurredAt: string;
  /** `YYYY-MM-DD`, derived from occurredAt. Every period query joins on this. */
  occurredOn: string;
  logType: LogType;
  momentTags: MomentTag[];
  /** The one-line question the model asked, kept beside its answer. */
  aiQuestion?: string | undefined;
  /** Optional by design (§14). Most records will not have one. */
  optionalAnswer?: string | undefined;
  /** v3 free text. Read-only: nothing new is written here. */
  body?: string | undefined;
  createdAt: string;
}

export interface NewLogInput {
  logType: LogType;
  momentTags: MomentTag[];
  aiQuestion?: string;
  optionalAnswer?: string;
  /** Defaults to now. */
  occurredAt?: string;
}

/**
 * What STAGE 1 read out of a single record (§16).
 *
 * Level 1 and Level 2 are the person's own evidence and are not in here: the
 * model does not get to revise them. Everything below is inference, and each
 * field is allowed to be absent rather than guessed.
 */
export interface LogAnalysis {
  logId: string;
  eventSummary: string;
  themes: string[];
  people: string[];
  action?: string | undefined;
  outcome?: string | undefined;
  friction?: string | undefined;
  discovery?: string | undefined;
  adaptation?: string | undefined;
  choice?: string | undefined;
  environment?: string | undefined;
  interestSignal?: string | undefined;
  journeyRole?: JourneyRole | undefined;
  confidence: number;
  analyzedAt?: string | undefined;
}

/** What one record is on its own. `neutral` whenever confidence is low. */
export type JourneyRole =
  | 'attempt'
  | 'friction'
  | 'breakthrough'
  | 'adaptation'
  | 'learning'
  | 'turning_point'
  | 'exploration'
  | 'continuation'
  | 'neutral';

export interface LogWithAnalysis extends DailyLog {
  analysis?: LogAnalysis | undefined;
  /** Progressions this record stands inside. Present on detail reads. */
  progressions?: ProgressionRef[] | undefined;
}

export interface ProgressionRef {
  id: string;
  title: string;
  role: ProgressionEvidenceRole;
}

// ---------------------------------------------------------------------------
// Progression (§17-§19)
// ---------------------------------------------------------------------------

/** The ten shapes a change can take. Internal; never shown as a label (§22). */
export type ProgressionPattern =
  | 'naming'
  | 'first_act'
  | 'repeat'
  | 'solo'
  | 'pivot'
  | 'expose'
  | 'own_call'
  | 'transfer'
  | 'reframe'
  | 'boundary';

export type ProgressionType =
  | 'capability'
  | 'strategy'
  | 'interest'
  | 'direction'
  | 'relationship'
  | 'perspective';

export type ProgressionMaturity = 'signal' | 'emerging' | 'evidenced' | 'established';

export type ProgressionEvidenceRole =
  | 'origin'
  | 'attempt'
  | 'friction'
  | 'adaptation'
  | 'evidence'
  | 'turning_point'
  | 'current';

export type ProgressionVerdict = 'accepted' | 'adjusted';

export interface Progression {
  id: string;
  userId: string;
  type: ProgressionType;
  /** Which of the ten it is. Decides what evidence it needs (§18). */
  pattern?: ProgressionPattern | undefined;
  /** The person's own words (§22), never a pattern or type name. */
  title: string;
  fromState?: string | undefined;
  currentState?: string | undefined;
  summary: string;
  maturity: ProgressionMaturity;
  /** Internal ordering signal. Never rendered as a number (§29). */
  confidence: number;
  /**
   * True when this grew outside the year's direction. Kept and marked rather
   * than discarded — repeated "enjoyed" is what this exists for (§19).
   */
  goalExternal: boolean;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  verdict?: ProgressionVerdict | undefined;
  userEdited: boolean;
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

/** One step on the PATH (§23), resolved for display. */
export interface ProgressionStep {
  logId: string;
  occurredOn: string;
  role: ProgressionEvidenceRole;
  /** The model's one-line reading of that record. */
  eventSummary: string;
  logType: LogType;
  momentTags: MomentTag[];
}

// ---------------------------------------------------------------------------
// Gain (§20, §21)
// ---------------------------------------------------------------------------

/**
 * Seven categories, and confidence is not among them.
 *
 * §20 is explicit about why: confidence is what a person feels after seeing
 * this evidence, not a thing the app can hand them.
 */
/**
 * The six kinds of gain.
 *
 * Progression is how someone walked; Gain is what the walking left them
 * holding. The seven that came before mixed the two — `capability` and
 * `recovery` described the walking — and split one thing across two names.
 * Each of these is something a person is left with.
 */
export type GainCategory =
  | 'evidence'
  | 'method'
  | 'insight'
  | 'connection'
  | 'criterion'
  | 'option';

export interface Gain {
  id: string;
  progressionId: string;
  category: GainCategory;
  label: string;
  description?: string | undefined;
  /** Internal ordering only. Never shown (§20). */
  confidence: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
}

export interface ProgressionDetail {
  progression: Progression;
  /** Oldest first. */
  steps: ProgressionStep[];
  /** Empty when nothing has settled — the honest common case. */
  gains: Gain[];
}

// ---------------------------------------------------------------------------
// Month & year (§25, §26)
// ---------------------------------------------------------------------------

export interface MonthProgression {
  progression: Progression;
  /** Ids of that month's records that moved it. */
  evidenceLogIds: string[];
  isNew: boolean;
  /** Where it stood at the end of that month, not where it is now. */
  maturityThen: ProgressionMaturity;
}

/**
 * The working-out behind one month of the map.
 *
 * `leadReason` is the sentence under the leading point — reasoned back from
 * the year's direction, so it says why that point is where the month opens.
 * The markdown brief is not carried to the device: it is the model's own
 * notes, kept so a later reading can see what an earlier one thought.
 */
export interface MonthMap {
  periodKey: string;
  leadProgressionId?: string | undefined;
  leadReason: string;
  /** Point ids, in the order the month opens with them. */
  points: string[];
  generatedAt: string;
}

export interface MonthReview {
  periodKey: string;
  /** What they set out with, copied at reading time so it cannot be rewritten. */
  initialTheme: string;
  /** `人に見せながら、伝え方を変え始めた月` */
  whatActuallyHappened: string;
  /** At most three, and never padded to three. */
  changed: MonthReviewChange[];
  /** At most three. */
  gained: MonthReviewGain[];
  /** Three offered; the person picks or writes their own. */
  titleCandidates: string[];
  /** The one they settled on, if they have. */
  title: string;
  subtitle: string;
  createdAt: string;
}

export interface MonthReviewChange {
  title: string;
  /** `「自分の中だけで考える」から「人に見せながら考える」へ。` */
  line: string;
}

export interface MonthReviewGain {
  category: GainCategory;
  label: string;
}

export interface YearReview {
  year: number;
  /** `自分の感性を仕事にする` */
  initialTheme: string;
  /** `人に見せながら、自分のやり方をつくった一年` */
  actualStory: string;
  progressions: MonthReviewChange[];
  gained: MonthReviewGain[];
  titleCandidates: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Immediate response (§31)
// ---------------------------------------------------------------------------

/**
 * The short line shown right after a save.
 *
 * One record never produces a progression, so this is deliberately small: what
 * was just left, named back plainly. No advice, no lesson, no trajectory.
 */
export interface Mirror {
  logId: string;
  line: string;
  /** Set when this record joined a progression that already existed. */
  joinedProgression?: { id: string; title: string } | undefined;
  /** Set when this save is what turned separate points into a line (§32). */
  emergedProgression?: { id: string; title: string; count: number } | undefined;
}
