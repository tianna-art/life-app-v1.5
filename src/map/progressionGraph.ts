/**
 * The map's layout model (§16–§20).
 *
 * ME is the centre and never moves. What radiates from it is not "what I
 * wrote" but "how I have moved": the person's own words for each progression,
 * and under each one the records of that month that moved it.
 *
 * Three levels, and no more. ME, the points, the records behind a point. The
 * steps used to be drawn as a chain that grew one link per record and reached
 * back through every earlier month, so a August node trailed a line from May
 * and the picture stopped being about August. A month's map is now built from
 * that month's records only, and the records hang off their point rather than
 * off each other.
 *
 * Two rules shape everything else. Level 1 is never a type name (§17): the
 * label is the title the model wrote in the person's own vocabulary, and
 * `capability` / `strategy` never reach the screen. And nothing may read as a
 * score (§19, §20): branches are seeded and jittered so the sky looks drawn
 * rather than computed, and weight only moves a node nearer or further, never
 * ranks it in a row.
 */
import type {
  MonthMap,
  MonthMapBranch,
  MonthProgression,
  ProgressionMaturity,
  ProgressionPattern,
} from '@/types';
import { MATURITY_OPACITY } from '@/constants/progression';
import { maturityRank } from '@/ai/progressionRules';

export interface MeNode {
  x: number;
  y: number;
  r: number;
}

export interface ProgressionNode {
  id: string;
  /** The person's own words. Never a type name. */
  title: string;
  x: number;
  y: number;
  r: number;
  /** 0..1 light, from maturity. Never rendered as a value. */
  glow: number;
  angle: number;
  isNew: boolean;
  hasVerdict: boolean;
  evidenceCount: number;
}

/**
 * One thing that happened under a point (level 3).
 *
 * Not a record but a grouping of them: the 観点 the month needed those
 * records read under. It carries the records it stands on, so opening it can
 * always show what it was read from.
 */
export interface StepNode {
  id: string;
  progressionId: string;
  label: string;
  summary: string;
  logIds: string[];
  x: number;
  y: number;
  r: number;
}

export interface GraphEdge {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: 'branch' | 'step';
}

export interface ProgressionGraph {
  me: MeNode;
  progressions: ProgressionNode[];
  steps: StepNode[];
  edges: GraphEdge[];
}

export interface BuildProgressionGraphInput {
  monthKey: string;
  progressions: readonly MonthProgression[];
  /** Emphasised, not expanded: opening a point no longer changes the shape. */
  expandedId?: string | null;
  /**
   * The month's brief. When there is one it decides which point opens the
   * month and what the sentence under it says; without one the month falls
   * back to what it can work out for itself.
   */
  lead?: MonthMap | null;
  /** Patterns the person's cards made worth watching (§19). */
  watched?: readonly ProgressionPattern[];
  width: number;
  height: number;
}

/** Deterministic PRNG so a month always settles into the same shape. */
function makeRng(seed: string): () => number {
  let h = 2166136261 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ME_RADIUS = 5;
const NODE_MIN_RADIUS = 3.5;
const NODE_MAX_RADIUS = 7;
const STEP_RADIUS = 2.4;

/** At most five points leave ME. More than that and the month reads as a list. */
export const MAX_POINTS = 5;

/** How many branches may hang off one point before it stops being legible. */
export const MAX_BRANCHES_PER_POINT = 4;

/**
 * A point has to be tellable apart into at least this many things.
 *
 * One branch is not a branch — it is the point restated. A progression whose
 * month cannot be read as two things belongs inside another point, not beside
 * it, so it is not drawn and the map gets smaller instead.
 */
export const MIN_BRANCHES_PER_POINT = 2;

/**
 * The cap once anything has been folded away.
 *
 * Merging is meant to reduce, so a map that had to drop a point does not
 * quietly refill the space from further down the order.
 */
export const MAX_POINTS_AFTER_MERGE = 4;

/**
 * How far out a progression sits.
 *
 * §20 lists what may count — evidence, duration, recency, coherence, the
 * person's confirmation, maturity — and then forbids the result from looking
 * like a grade. So weight is spent on distance and light, both of which the
 * eye reads as depth rather than rank, and it is deliberately compressed: the
 * gap between the least and most settled node is smaller than the jitter
 * between neighbours.
 */
function weightOf(item: MonthProgression): number {
  const { progression } = item;
  const evidence = Math.min(1, progression.evidenceCount / 6);
  const settled = maturityRank(item.maturityThen) / 3;
  // Agreeing pulls a progression closer; correcting it does the same, because
  // a corrected one is the person's own and matters more, not less.
  const confirmed = progression.verdict ? 0.15 : 0;
  return Math.min(1, evidence * 0.4 + settled * 0.45 + confirmed);
}

function radiusFor(weight: number): number {
  return NODE_MIN_RADIUS + (NODE_MAX_RADIUS - NODE_MIN_RADIUS) * weight;
}

function glowFor(maturity: ProgressionMaturity): number {
  return MATURITY_OPACITY[maturity] ?? MATURITY_OPACITY.signal;
}

export interface SelectMonthPointsOptions {
  /**
   * The patterns the person's chosen cards make worth looking for.
   *
   * §19: the lens raises priority and never filters. A progression that
   * matches none of them is still eligible and still keeps its point when the
   * month has nothing else — the direction decides what to look at first, not
   * what is allowed to exist.
   */
  watched?: readonly ProgressionPattern[];
  /** The month's brief, which decided the points and what is under each. */
  brief?: MonthMap | null;
  limit?: number;
}

/** What the brief said hangs off a point, if it said anything. */
export function branchesFor(brief: MonthMap | null | undefined, id: string): MonthMapBranch[] {
  return (
    brief?.points
      .find((point) => point.progressionId === id)
      ?.branches.slice(0, MAX_BRANCHES_PER_POINT) ?? []
  );
}

/**
 * Which of the month's progressions get a point, and in what order.
 *
 * A point has to be tellable apart into two things. Where the brief has read
 * the month, that means two branches; a progression it could only restate is
 * folded away rather than drawn beside the others, and the map is capped
 * lower afterwards so the space it left is not refilled from further down.
 * Merging is meant to reduce.
 *
 * Order, where points are eligible: the brief first — it read the direction
 * and the cards, and choosing which points bear on them is the judgement a
 * model is for. Then the lens, which moves a watched pattern up but never
 * keeps anything off (§19). Then what the month itself holds.
 *
 * Before any brief exists there are no branches to count, so nothing is
 * folded and the month is ordered on its own terms.
 */
export function selectMonthPoints(
  progressions: readonly MonthProgression[],
  options: SelectMonthPointsOptions | number = {}
): MonthProgression[] {
  const { watched = [], brief = null, limit = MAX_POINTS } =
    typeof options === 'number' ? { limit: options } : options;

  const watchedSet = new Set(watched);
  const briefOrder = new Map(
    (brief?.points ?? []).map((point, index) => [point.progressionId, index])
  );

  const ordered = [...progressions].sort((a, b) => {
    const aBrief = briefOrder.get(a.progression.id) ?? Number.POSITIVE_INFINITY;
    const bBrief = briefOrder.get(b.progression.id) ?? Number.POSITIVE_INFINITY;
    if (aBrief !== bBrief) return aBrief - bBrief;

    const aWatched = a.progression.pattern && watchedSet.has(a.progression.pattern) ? 1 : 0;
    const bWatched = b.progression.pattern && watchedSet.has(b.progression.pattern) ? 1 : 0;
    if (aWatched !== bWatched) return bWatched - aWatched;

    const byMonthEvidence = b.evidenceLogIds.length - a.evidenceLogIds.length;
    if (byMonthEvidence !== 0) return byMonthEvidence;
    const bySettled = maturityRank(b.maturityThen) - maturityRank(a.maturityThen);
    if (bySettled !== 0) return bySettled;
    return b.progression.confidence - a.progression.confidence;
  });

  if (!brief) return ordered.slice(0, limit);

  const tellable = ordered.filter(
    (item) => branchesFor(brief, item.progression.id).length >= MIN_BRANCHES_PER_POINT
  );

  // A brief that can tell nothing apart is a brief that is not usable — it
  // was written under an older shape, or the model had nothing to say. The
  // month still happened, so it is drawn on its own terms rather than not at
  // all: an empty sky is a claim that nothing occurred, and this is the one
  // case where that claim would be the app's mistake rather than the truth.
  if (tellable.length === 0) return ordered.slice(0, limit);

  const folded = ordered.length - tellable.length;
  return tellable.slice(0, folded > 0 ? Math.min(limit, MAX_POINTS_AFTER_MERGE) : limit);
}

export function buildProgressionGraph({
  monthKey,
  progressions,
  expandedId = null,
  lead = null,
  watched = [],
  width,
  height,
}: BuildProgressionGraphInput): ProgressionGraph {
  const rng = makeRng(monthKey);
  const cx = width / 2;
  const cy = height / 2;
  const me: MeNode = { x: cx, y: cy, r: ME_RADIUS };

  const points = selectMonthPoints(progressions, { watched, brief: lead });
  if (points.length === 0 || width <= 0 || height <= 0) {
    return { me, progressions: [], steps: [], edges: [] };
  }

  // The shortest side bounds the reach, so nothing leaves the canvas on a
  // narrow phone; the inner margin keeps the first ring clear of ME. The
  // outer fifth is left for the records that hang off each point.
  const reach = (Math.min(width, height) / 2 - NODE_MAX_RADIUS * 4) * 0.78;
  const inner = reach * 0.42;
  const span = reach - inner;

  const slice = (Math.PI * 2) / points.length;
  // A whole-sky offset so two months with the same count are not the same
  // picture, and no branch points straight up by default.
  const rotation = rng() * Math.PI * 2;

  const nodes: ProgressionNode[] = [];
  const edges: GraphEdge[] = [];
  const steps: StepNode[] = [];

  points.forEach((item, index) => {
    const weight = weightOf(item);
    // Jitter inside the slice — never across it, so branches cannot collide —
    // is what turns an even pie into something that reads as drawn (§20).
    const angle = rotation + slice * index + (rng() - 0.5) * slice * 0.55;
    // More weight sits nearer the centre: closer to ME is closer to settled.
    const distance = inner + span * (1 - weight) * (0.55 + rng() * 0.45);

    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;

    nodes.push({
      id: item.progression.id,
      title: item.progression.title,
      x,
      y,
      r: radiusFor(weight),
      glow: glowFor(item.maturityThen),
      angle,
      isNew: item.isNew,
      hasVerdict: Boolean(item.progression.verdict),
      evidenceCount: item.progression.evidenceCount,
    });

    edges.push({
      id: `branch:${item.progression.id}`,
      fromX: cx,
      fromY: cy,
      toX: x,
      toY: y,
      kind: 'branch',
    });

    // Only an opened point shows what is under it. Everything else would put
    // twenty labels on one sky.
    if (expandedId === item.progression.id) {
      layoutBranches({
        node: nodes[nodes.length - 1] as ProgressionNode,
        branches: branchesFor(lead, item.progression.id),
        rng,
        reach,
        edges,
        out: steps,
      });
    }
  });

  if (expandedId) {
    for (const node of nodes) {
      if (node.id !== expandedId) continue;
      node.glow = Math.min(1, node.glow + 0.25);
    }
  }

  return { me, progressions: nodes, steps, edges };
}

/**
 * What is under one point, fanned out beyond it.
 *
 * A fan rather than a chain: each branch answers to the point it belongs to,
 * not to the branch before it. Chained, the picture grew a level for every
 * one; fanned, the depth is fixed at three however much the month held.
 */
function layoutBranches({
  node,
  branches,
  rng,
  reach,
  edges,
  out,
}: {
  node: ProgressionNode;
  branches: readonly MonthMapBranch[];
  rng: () => number;
  reach: number;
  edges: GraphEdge[];
  out: StepNode[];
}): void {
  if (branches.length === 0) return;

  const gap = Math.max(18, Math.min(34, reach * 0.26));
  // The fan opens along the branch's own direction, so the eye keeps going
  // the way it was already going.
  const spread = branches.length === 1 ? 0 : Math.PI / 4;

  branches.forEach((branch, index) => {
    const offset =
      branches.length === 1 ? 0 : -spread / 2 + (spread / (branches.length - 1)) * index;
    const angle = node.angle + offset + (rng() - 0.5) * 0.1;
    const distance = gap * (0.85 + rng() * 0.3);

    const x = node.x + Math.cos(angle) * distance;
    const y = node.y + Math.sin(angle) * distance;

    out.push({
      id: `branch:${node.id}:${index}`,
      progressionId: node.id,
      label: branch.label,
      summary: branch.summary,
      logIds: branch.logIds,
      x,
      y,
      r: STEP_RADIUS,
    });

    edges.push({
      id: `branch-edge:${node.id}:${index}`,
      fromX: node.x,
      fromY: node.y,
      toX: x,
      toY: y,
      kind: 'step',
    });
  });
}
