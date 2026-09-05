/**
 * Domain types for crincran.
 *
 * The product principle decides the shape of this file: the person leaves an
 * event, and everything interpretive — what kind of moment it was, what it
 * connects to, what stayed — lives in AI-produced rows beside the entry, never
 * in fields the person has to fill in.
 */

/** The only thing the person classifies: one tap, three drawers (§6). */
export type InputCategory = 'progress' | 'friction' | 'moved';

/** Gain ontology (§2). Assigned by the AI; never shown as a form to the user. */
export type GainType =
  | 'capability'
  | 'insight'
  | 'strategy'
  | 'direction'
  | 'connection'
  | 'evidence';

/** How settled a gain is (§3). The AI may never jump straight to the top. */
export type GainMaturity = 'signal' | 'attempt' | 'emerging' | 'evidenced' | 'established';

/** Whether anything could honestly be extracted from one entry (§1). */
export type GainStatus = 'confirmed' | 'possible' | 'unresolved';

/** Trial & error kept as its own layer (§4). A setback stays a setback. */
export type JourneyRole =
  | 'attempt'
  | 'setback'
  | 'breakthrough'
  | 'adaptation'
  | 'learning'
  | 'turning_point'
  | 'neutral';

/** How one entry relates to an earlier one (§10). */
export type JourneyRelation =
  | 'same_theme'
  | 'progression'
  | 'contrast'
  | 'adaptation'
  | 'consequence';

/** How an entry supports a gain (§25). */
export type EvidenceRelation = 'supports' | 'created' | 'strengthened' | 'contradicts';

/** The whole feedback vocabulary (§27). Two options, nothing more. */
export type GainVerdict = 'accepted' | 'adjusted';

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  userId: string;
  /** Full timestamp of the moment the entry belongs to. */
  occurredAt: string;
  /** `YYYY-MM-DD`, derived from occurredAt. Every period query joins on this. */
  occurredOn: string;
  inputCategory: InputCategory;
  body: string;
  createdAt: string;
}

/** What the AI read out of a single entry (§10). */
export interface EntryAnalysis {
  logId: string;
  eventSummary: string;
  journeyRole: JourneyRole;
  gainStatus: GainStatus;
  semanticTags: string[];
  analyzedAt?: string | undefined;
}

export interface EntryWithAnalysis extends JournalEntry {
  analysis?: EntryAnalysis | undefined;
  /** Gains this entry is evidence for. Present on detail reads. */
  gains?: Gain[] | undefined;
}

export interface NewEntryInput {
  inputCategory: InputCategory;
  body: string;
  /** Defaults to now. */
  occurredAt?: string;
}

// ---------------------------------------------------------------------------
// Gains
// ---------------------------------------------------------------------------

export interface Gain {
  id: string;
  userId: string;
  type: GainType;
  label: string;
  maturity: GainMaturity;
  /** Internal ordering signal. Never rendered as a number (§23). */
  confidence: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  /** Set once the person has said 納得した / 少し違う. */
  verdict?: GainVerdict | undefined;
  /** Non-null when this gain was folded into a broader one (§26). */
  mergedIntoId?: string | undefined;
}

export interface GainEvidence {
  gainId: string;
  logId: string;
  relation: EvidenceRelation;
  /** The quoted-back reason, in the person's own material. */
  note?: string | undefined;
  createdAt: string;
}

export interface JourneyLink {
  fromLogId: string;
  toLogId: string;
  relation: JourneyRelation;
  confidence: number;
}

/** One evidence entry resolved for the HOW IT FORMED path (§17). */
export interface GainFormationStep {
  logId: string;
  occurredOn: string;
  journeyRole: JourneyRole;
  eventSummary: string;
  relation: EvidenceRelation;
}

/** A gain plus everything needed to explain it, loaded when a node is tapped. */
export interface GainDetail {
  gain: Gain;
  formation: GainFormationStep[];
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

/** The month-end reading (§19). Three pieces of information, no more. */
export interface MonthReview {
  periodKey: string;
  /** `OUT INTO THE WORLD` */
  title: string;
  /** `外に出し始めた月` */
  subtitle: string;
  /** At most three gain labels. */
  gains: string[];
  /** Evidence-based comparison with earlier months. Empty when there is none. */
  oneChange: string;
  createdAt: string;
}

/** The single line shown right after a save (§8). */
export interface TodaysGain {
  logId: string;
  /** Empty when nothing could honestly be said. */
  line: string;
  gainId?: string | undefined;
  gainType?: GainType | undefined;
}
