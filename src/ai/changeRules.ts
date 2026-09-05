/**
 * What a change has to clear before anyone sees it (§43).
 *
 * §43 is written as ten questions the model should ask itself. A model asked
 * politely to check its own work will answer that it checked. So the questions
 * are answered here instead, on the parsed output, with no imports and no
 * network — the same file runs in the app and inside the Edge Function, and
 * `npm run sync:rules` keeps the two byte-identical.
 *
 * The bar is deliberately high enough to return nothing. §31 says zero changes
 * is a valid month, and a month that produced nothing worth showing is more
 * useful than one padded to three: the person can tell the difference, and
 * once they catch the app inventing one, none of the others are worth reading.
 */

// ---------------------------------------------------------------------------
// Vocabulary (duplicated from src/types on purpose — this file has no imports)
// ---------------------------------------------------------------------------

export type ChangeTargetType =
  | 'month_declaration'
  | 'year_direction'
  | 'desired_self'
  | 'emerging_direction';

export type ChangeConfidence = 'signal' | 'supported' | 'strong';

export type ChangeEvidenceRole =
  | 'before'
  | 'attempt'
  | 'friction'
  | 'change'
  | 'evidence'
  | 'current';

export const CHANGE_TARGET_TYPES: readonly ChangeTargetType[] = [
  'month_declaration',
  'year_direction',
  'desired_self',
  'emerging_direction',
] as const;

export const CHANGE_CONFIDENCES: readonly ChangeConfidence[] = [
  'signal',
  'supported',
  'strong',
] as const;

export const CHANGE_EVIDENCE_ROLES: readonly ChangeEvidenceRole[] = [
  'before',
  'attempt',
  'friction',
  'change',
  'evidence',
  'current',
] as const;

// ---------------------------------------------------------------------------
// The limits
// ---------------------------------------------------------------------------

/** §31. Three is a ceiling, never a quota. */
export const MAX_CHANGES = 3;

/** §20, §36. One record is an observation; it is not a change. */
export const MIN_EVIDENCE = 2;

/** §26. The card prints this many records before it says anything of its own. */
export const EVIDENCE_SHOWN = 3;

/** §19. A title is what changed, so it is a phrase and not an essay. */
export const MAX_TITLE_LENGTH = 20;

/**
 * §19's BAD list, plus the ones the same mistake produces.
 *
 * These are topics: what the writing was about. A map made of them is the
 * topic map §18 rules out, and it is the failure this app falls into by
 * default, because grouping records by subject is easy and grouping them by
 * what moved is not.
 *
 * Matched against the whole title, not inside it: 「仕事」is a topic and
 * 「仕事以外の時間を守る」is a change.
 */
export const TOPIC_TITLES: readonly string[] = [
  'キャリア',
  '仕事',
  '人間関係',
  '自分',
  'モヤモヤ',
  '計画',
  'デザイン',
  '転職',
  '副業',
  '創作',
  '人',
  '時間',
  '将来',
  '成長',
  'お金',
  '健康',
  '趣味',
  '生活',
] as const;

/**
 * Words that describe the person rather than the movement (§29, §30).
 *
 * A title carrying one of these has stopped being a reading of records and
 * become a diagnosis — 「自己決定性」 is the example §30 gives, and it is
 * exactly what an abstraction-shaped model reaches for.
 */
export const DIAGNOSIS_WORDS: readonly string[] = [
  '性が',
  '力が向上',
  '主体的',
  '自己決定性',
  '積極性',
  '能動的',
  '内省',
  '自己肯定',
  'マインド',
  'ポテンシャル',
  '本質的',
] as const;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface RawChangeEvidence {
  logId: string;
  role: ChangeEvidenceRole;
}

export interface ParsedChange {
  title: string;
  linkedTargetType: ChangeTargetType;
  linkedTargetId?: string;
  linkedTargetLabel: string;
  beforeState?: string;
  currentState: string;
  observation: string;
  targetConnection: string;
  confidence: ChangeConfidence;
  evidence: RawChangeEvidence[];
  progressionId?: string;
  gains: ParsedGain[];
}

export interface ParsedGain {
  category: string;
  label: string;
  evidenceLogIds: string[];
}

export interface ChangeContext {
  /** Every record id the reading was given. Anything else is invented. */
  knownLogIds: ReadonlySet<string>;
  /** Records that fall inside the month being read. */
  monthLogIds: ReadonlySet<string>;
  /** Ids of the detections offered, so provenance cannot be fabricated. */
  knownProgressionIds: ReadonlySet<string>;
  /**
   * The things the person actually put down, by target type.
   *
   * A change claiming to answer to a desired-self card the person never chose
   * would be the app inventing the target as well as the change, so labels are
   * checked against this rather than trusted.
   */
  targets: ReadonlyMap<ChangeTargetType, ReadonlyMap<string, string>>;
  /**
   * Records whose only moment tags are 「モヤモヤ」 (§35) or 「楽しかった」 (§34).
   *
   * Neither is a change on its own. A candidate standing entirely on one kind
   * is evidence waiting for something to connect to, and saying otherwise is
   * how "you seem frustrated" gets printed as growth.
   */
  frictionOnlyLogIds: ReadonlySet<string>;
  enjoyedOnlyLogIds: ReadonlySet<string>;
}

export interface RejectedChange {
  title: string;
  /** Why, in the words the code used. Written to the brief, never to screen. */
  reason: string;
}

export interface ChangeReading {
  changes: ParsedChange[];
  rejected: RejectedChange[];
}

function text(value: unknown, limit = 400): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function isTargetType(value: unknown): value is ChangeTargetType {
  return typeof value === 'string' && (CHANGE_TARGET_TYPES as readonly string[]).includes(value);
}

function isConfidence(value: unknown): value is ChangeConfidence {
  return typeof value === 'string' && (CHANGE_CONFIDENCES as readonly string[]).includes(value);
}

function isEvidenceRole(value: unknown): value is ChangeEvidenceRole {
  return (
    typeof value === 'string' && (CHANGE_EVIDENCE_ROLES as readonly string[]).includes(value)
  );
}

/**
 * §19 — is this a title about what changed, or about what was written about?
 *
 * The topic check is whole-string: a topic word inside a longer phrase is
 * usually doing honest work (「仕事以外の時間を守る」), while a title that is
 * only the topic word is the failure mode.
 */
export function isTopicTitle(title: string): boolean {
  const trimmed = title.trim().replace(/[。、・\s]/g, '');
  if (trimmed.length === 0) return true;
  if ((TOPIC_TITLES as readonly string[]).includes(trimmed)) return true;
  return DIAGNOSIS_WORDS.some((word) => trimmed.includes(word));
}

/**
 * §17 — how strong the wording may get, given what is actually behind it.
 *
 * `strong` is the only level allowed to say 「以前の〜から、最近は〜へ」, so it
 * is the only one that needs a record from before the month saying where the
 * person was. Without one there is no "before" to have moved from, and the
 * sentence would be a story rather than a comparison (§16).
 */
export function confidenceCeiling(input: {
  evidenceCount: number;
  hasBeforeEvidence: boolean;
  hasBeforeState: boolean;
}): ChangeConfidence {
  if (input.evidenceCount < MIN_EVIDENCE) return 'signal';
  if (input.hasBeforeEvidence && input.hasBeforeState && input.evidenceCount >= 3) {
    return 'strong';
  }
  return 'supported';
}

function rankOf(confidence: ChangeConfidence): number {
  return CHANGE_CONFIDENCES.indexOf(confidence);
}

export function capConfidence(
  claimed: ChangeConfidence,
  ceiling: ChangeConfidence
): ChangeConfidence {
  return rankOf(claimed) <= rankOf(ceiling) ? claimed : ceiling;
}

/**
 * §42 — two names for one movement.
 *
 * Titles are compared loosely and evidence strictly. Two candidates standing
 * on the same records are one change however differently they are worded, and
 * the one that survives is the one that came first — the reading put its own
 * best first, and re-ranking it here would be second-guessing the judgement
 * the model is actually for.
 */
function isDuplicate(candidate: ParsedChange, kept: readonly ParsedChange[]): boolean {
  const ids = new Set(candidate.evidence.map((e) => e.logId));
  return kept.some((existing) => {
    const existingIds = new Set(existing.evidence.map((e) => e.logId));
    const shared = [...ids].filter((id) => existingIds.has(id)).length;
    // Contained in, or containing, another change's evidence.
    if (shared === ids.size || shared === existingIds.size) return true;
    const a = existing.title.replace(/[\s。、]/g, '');
    const b = candidate.title.replace(/[\s。、]/g, '');
    return a === b || a.includes(b) || b.includes(a);
  });
}

/**
 * Read the month's changes out of what the model returned.
 *
 * Everything §43 asks is decided here, and a candidate that fails any of it is
 * dropped with the reason kept. The reasons go into the month's brief, so a
 * month that published nothing can still be explained.
 */
export function parseChangeReading(value: unknown, context: ChangeContext): ChangeReading {
  const raw = (value ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw.changes) ? raw.changes : [];

  const changes: ParsedChange[] = [];
  const rejected: RejectedChange[] = [];
  const reject = (title: string, reason: string) => rejected.push({ title, reason });

  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;

    const title = text(entry.title, MAX_TITLE_LENGTH * 2);
    if (title.length === 0) continue;

    // Q7 / §19: a topic is not a change, and neither is a diagnosis.
    if (isTopicTitle(title)) {
      reject(title, '何が変わったかではなく、何についてかを書いている');
      continue;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      reject(title, `タイトルが${MAX_TITLE_LENGTH}字を超えている`);
      continue;
    }

    // Q3 / Q6 / §20-1: the records have to exist and there have to be enough
    // of them. Ids outside what was handed over are invented.
    const seenLogs = new Set<string>();
    const evidence: RawChangeEvidence[] = (
      Array.isArray(entry.evidence) ? entry.evidence : []
    ).flatMap((e) => {
      if (typeof e !== 'object' || e === null) return [];
      const row = e as Record<string, unknown>;
      const logId = typeof row.log_id === 'string' ? row.log_id : '';
      if (!context.knownLogIds.has(logId) || seenLogs.has(logId)) return [];
      seenLogs.add(logId);
      return [{ logId, role: isEvidenceRole(row.role) ? row.role : ('evidence' as const) }];
    });

    if (evidence.length < MIN_EVIDENCE) {
      reject(title, `根拠が${evidence.length}件。${MIN_EVIDENCE}件に満たない`);
      continue;
    }

    // §34, §35: 「モヤモヤ」だけ、「楽しかった」だけ の記録は、まだ変化ではない。
    const everyLogIsFriction = evidence.every((e) => context.frictionOnlyLogIds.has(e.logId));
    if (everyLogIsFriction) {
      reject(title, 'モヤモヤの記録だけで立っている。まだ変化ではない');
      continue;
    }
    const everyLogIsEnjoyed = evidence.every((e) => context.enjoyedOnlyLogIds.has(e.logId));
    if (everyLogIsEnjoyed) {
      reject(title, '楽しかったの記録だけで立っている。方向の候補であって変化ではない');
      continue;
    }

    // Q1 / §14: which of the things they put down does this answer to.
    if (!isTargetType(entry.linked_target_type)) {
      reject(title, '何に対する変化なのかが書かれていない');
      continue;
    }
    const linkedTargetType = entry.linked_target_type;
    const known = context.targets.get(linkedTargetType);
    const linkedTargetId = text(entry.linked_target_id, 80);
    let linkedTargetLabel = text(entry.linked_target_label, 120);

    if (linkedTargetType === 'emerging_direction') {
      // §34: this one has no id, because the person never put it down. It is
      // what the records turned up on their own, and it is a discovery.
      if (linkedTargetLabel.length === 0) {
        reject(title, '新しい方向の名前が書かれていない');
        continue;
      }
    } else {
      const label = linkedTargetId ? known?.get(linkedTargetId) : undefined;
      if (!label) {
        reject(title, '本人が置いていないものに紐づけようとしている');
        continue;
      }
      // The person's own wording wins over the model's paraphrase of it.
      linkedTargetLabel = label;
    }

    // Q7 / §26, §27: the card has both halves or it does not print.
    const observation = text(entry.observation);
    const targetConnection = text(entry.target_connection);
    if (observation.length === 0 || targetConnection.length === 0) {
      reject(title, '見えてきたこと、またはありたい姿とのつながりが空');
      continue;
    }

    // Q4 / §16: a before state stands on a record from before this month, or
    // it does not exist. This is the invention the app must never make.
    const hasBeforeEvidence = evidence.some(
      (e) => !context.monthLogIds.has(e.logId) || e.role === 'before'
    );
    const claimedBefore = text(entry.before_state, 200);
    const beforeState = hasBeforeEvidence && claimedBefore.length > 0 ? claimedBefore : undefined;

    const ceiling = confidenceCeiling({
      evidenceCount: evidence.length,
      hasBeforeEvidence,
      hasBeforeState: Boolean(beforeState),
    });
    const confidence = capConfidence(
      isConfidence(entry.confidence) ? entry.confidence : 'signal',
      ceiling
    );

    const progressionId =
      typeof entry.progression_id === 'string' &&
      context.knownProgressionIds.has(entry.progression_id)
        ? entry.progression_id
        : undefined;

    const gains: ParsedGain[] = (Array.isArray(entry.gains) ? entry.gains : []).flatMap((g) => {
      if (typeof g !== 'object' || g === null) return [];
      const row = g as Record<string, unknown>;
      const label = text(row.label, 60);
      const category = text(row.category, 40);
      if (label.length === 0 || category.length === 0) return [];
      const logIds = (Array.isArray(row.evidence_log_ids) ? row.evidence_log_ids : []).filter(
        (id): id is string => typeof id === 'string' && seenLogs.has(id)
      );
      // §32, §33: a gain is what a change left behind, so it stands on the
      // change's own records or it is not stored.
      if (logIds.length === 0) return [];
      return [{ category, label, evidenceLogIds: logIds }];
    });

    const candidate: ParsedChange = {
      title,
      linkedTargetType,
      ...(linkedTargetId && linkedTargetType !== 'emerging_direction' ? { linkedTargetId } : {}),
      linkedTargetLabel,
      ...(beforeState ? { beforeState } : {}),
      currentState: text(entry.current_state, 200),
      observation,
      targetConnection,
      confidence,
      evidence,
      ...(progressionId ? { progressionId } : {}),
      gains,
    };

    // Q9 / §42: same movement, two names.
    if (isDuplicate(candidate, changes)) {
      reject(title, 'すでに出ている変化と同じものを別の言葉で呼んでいる');
      continue;
    }

    changes.push(candidate);
  }

  // Q10 / §31: three is where it stops, and nothing is added to reach it.
  return { changes: changes.slice(0, MAX_CHANGES), rejected };
}

/**
 * The wording §17 allows at each level.
 *
 * Kept beside the ceiling that produces it, so a change can never be described
 * more strongly than the records it stands on — the two would otherwise drift
 * apart in different files.
 */
export function phraseForConfidence(confidence: ChangeConfidence): string {
  switch (confidence) {
    case 'strong':
      return '以前の記録との違いが、はっきり見えています。';
    case 'supported':
      return 'この変化を示す記録が、複数あります。';
    default:
      return 'この方向につながる記録がありました。';
  }
}
