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

/**
 * The vocabulary a record is filed under.
 *
 * `src/domain/antennas.ts` holds the five antennas, the fifteen categories and
 * the details under each. It is the source of truth for the ids and for every
 * label; nothing here restates them.
 */
import type { AntennaId, CategoryId, DetailId } from '@/domain/antennas';

export type { AntennaId, CategoryId, DetailId };

/** How the record was left. */
export type LogInputMethod = 'category' | 'free_text' | 'voice' | 'flow';

/** Who filed it. A free-text entry is classified by the reading, not the person. */
export type ClassificationSource = 'user' | 'ai';
export type ClassificationStatus = 'confirmed' | 'pending' | 'unclassified';

/**
 * A second category the classifier also saw.
 *
 * Kept beside the chosen one rather than instead of it: a record can be
 * evidence for another antenna without the person having filed it there.
 */
export interface AiSignal {
  antennaId: string;
  categoryId: string;
}

/**
 * The door a v3 record was left through, and what kind of moment it was.
 *
 * Retired 2026-09 in favour of the antenna vocabulary. Rows written under them
 * keep them, and the archive still prints what they carry, so the types stay
 * — nothing new is written with either.
 */
export type LegacyLogType = 'self_action' | 'relationship' | 'thought';

export type LegacyMomentTag =
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
  /**
   * The month's antennas, in the order they were picked. At most two.
   *
   * This is the lens. It used to be the year's — ten directions and thirty-one
   * cards chosen once — and it is the month's now, because a month is the unit
   * of observation and a lens that cannot be re-aimed stops matching the
   * person before the year is out.
   */
  antennaIds: AntennaId[];
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
  /**
   * One of the fifteen. Absent on a free-text entry nothing has read yet, and
   * on every record written before the antennas existed.
   */
  categoryId?: CategoryId | undefined;
  /** One option under that category. Its meaning depends on the category. */
  detailId?: DetailId | undefined;
  inputMethod: LogInputMethod;
  classificationSource: ClassificationSource;
  classificationStatus: ClassificationStatus;
  /** Other categories the classifier saw. Never overrides the chosen one. */
  aiSignals: AiSignal[];
  /** What the person wrote. `何があった？` is the same question every time. */
  body?: string | undefined;
  /** v4 rows: the one-line question the model asked, beside its answer. */
  aiQuestion?: string | undefined;
  optionalAnswer?: string | undefined;
  /** v3/v4 rows only. Nothing new is written with either. */
  legacyLogType?: LegacyLogType | undefined;
  legacyMomentTags?: LegacyMomentTag[] | undefined;
  createdAt: string;
}

export interface NewLogInput {
  /** Absent when the record was left as free text for the reading to file. */
  categoryId?: CategoryId;
  detailId?: DetailId;
  body?: string;
  inputMethod?: LogInputMethod;
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
  categoryId?: CategoryId | undefined;
  detailId?: DetailId | undefined;
}

// ---------------------------------------------------------------------------
// Gain (§20, §21)
// ---------------------------------------------------------------------------

/**
 * The seven kinds of gain (§32), and confidence is not among them.
 *
 * §20 is explicit about why: confidence is what a person feels after seeing
 * this evidence, not a thing the app can hand them.
 *
 * A gain is never read off a single record (§33). It is what is left over
 * once a change has been established, so it hangs off the change and not off
 * the log.
 */
export type GainCategory =
  | 'clarity'
  | 'capability'
  | 'method'
  | 'choice'
  | 'evidence'
  | 'connection'
  | 'recovery';

export interface Gain {
  id: string;
  /** The change it came out of. Never read straight off a record (§33). */
  changeId?: string | undefined;
  /** The detection behind it. Kept for gains written before changes existed. */
  progressionId?: string | undefined;
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
// Change — the published reading (§22, §40)
// ---------------------------------------------------------------------------

/**
 * Which of the things the person put down at the start this answers to (§14).
 *
 * Priority when more than one fits: the month's declaration, then the year's
 * direction, then a desired-self card. `emerging_direction` is the one that
 * points outward — what repeated enjoyment outside the stated direction turns
 * into (§34). It is a discovery, not a miss, and is never marked as one.
 */
export type ChangeTargetType =
  | 'month_declaration'
  | 'year_direction'
  | 'desired_self'
  | 'emerging_direction';

/**
 * How much the records will carry (§17).
 *
 * It decides the wording and nothing else. `signal` says a record points that
 * way; `supported` says it is visible across several; `strong` is the only one
 * allowed to say "以前の〜から、最近は〜へ", and it is the only one that needs
 * a record from before this month to stand on.
 */
export type ChangeConfidence = 'signal' | 'supported' | 'strong';

/** What one record does inside a change. */
export type ChangeEvidenceRole =
  | 'before'
  | 'attempt'
  | 'friction'
  | 'change'
  | 'evidence'
  | 'current';

/**
 * One published change (§22).
 *
 * The map point and the card under it are this, not two things generated
 * separately and hoped to agree. `title` is printed in both places, `position`
 * is the order both use, and `evidence` is what the card prints before it says
 * anything of its own (§27).
 *
 * A progression is how the reading found this; a change is what it decided to
 * show for this month. They have different lifetimes, which is why they are
 * different objects.
 */
export interface Change {
  id: string;
  userId: string;
  periodType: PeriodType;
  year: number;
  month?: number | undefined;
  /** What changed, in the person's words. Never a topic name (§19). */
  title: string;
  linkedTargetType: ChangeTargetType;
  linkedTargetId?: string | undefined;
  linkedTargetLabel: string;
  /** Only ever set when a record from before says so (§16). */
  beforeState?: string | undefined;
  currentState: string;
  /** 見えてきたこと — what the records show. */
  observation: string;
  /** ありたい姿とのつながり — what that has to do with what they wanted. */
  targetConnection: string;
  confidence: ChangeConfidence;
  /** The order the map and the card list share. */
  position: number;
  /** The detection this was read from. Kept so a reading is never orphaned. */
  progressionId?: string | undefined;
  verdict?: ProgressionVerdict | undefined;
  userEdited: boolean;
  /** Oldest first. Two or more, always (§20, §36). */
  evidence: ChangeEvidenceEntry[];
  /** What is left over, if anything has settled (§32). Usually empty. */
  gains: Gain[];
  createdAt: string;
  updatedAt: string;
}

/** One record the card prints, resolved for display. */
export interface ChangeEvidenceEntry {
  logId: string;
  occurredOn: string;
  role: ChangeEvidenceRole;
  /** The record as it was written. Not a paraphrase (§26). */
  text: string;
  /** What the person filed it under. The card prints the label, not the id. */
  categoryId?: CategoryId | undefined;
  detailId?: DetailId | undefined;
}

export type PeriodType = 'month' | 'year' | 'long_term';

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
 * The working-out behind one month, kept and never rendered.
 *
 * Markdown notes the reading wrote for itself while deciding which changes to
 * publish: the candidates, what each stood on, and what it could not yet say.
 * It is stored so a later pass can see what an earlier one thought, and so a
 * reading on screen has something behind it other than the model's memory.
 *
 * What the map draws comes from `Change`, not from here (§22). This used to
 * carry the points and their branches too, which made it a second opinion
 * about the month that nothing reconciled with the first.
 */
export interface MonthBrief {
  periodKey: string;
  briefMarkdown: string;
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
