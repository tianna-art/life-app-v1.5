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
  /**
   * Shown under the leading point only. One point carries the reason the
   * month starts where it starts; the rest would turn the sky into a page.
   */
  summary?: string | undefined;
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

/** One record of that month, hanging off the point it moved (level 3). */
export interface StepNode {
  id: string;
  progressionId: string;
  logId: string;
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

/** How many records may hang off one point before it stops being legible. */
export const MAX_BRANCHES_PER_POINT = 4;

/**
 * A month worth looking at has more than one thing happening in it, so the
 * selection makes sure at least this many points carry records of their own.
 */
export const MIN_BRANCHING_POINTS = 2;

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
  /** The five the brief chose, having read the direction itself. */
  brief?: readonly string[];
  limit?: number;
}

/**
 * Which of the month's progressions get a point, and in what order.
 *
 * Three things decide it, in this order.
 *
 * The brief first, when there is one: it has read the year's direction and
 * the cards, and choosing the five that bear on them is exactly the judgement
 * a model is for. It may only choose from what the month holds — a
 * progression with no records this month is not a candidate and no reasoning
 * can make it one.
 *
 * Then the lens: a progression whose pattern is one the person's cards made
 * worth watching comes before one that does not. This is priority, never a
 * filter (§19) — repeated "enjoyed" growing outside the year's direction is
 * exactly the thing that must not be filtered away.
 *
 * Then what the month actually holds: its own records, then how settled the
 * progression was by the end of it. A progression that ran all year but was
 * touched once in August does not lead August.
 *
 * Finally the branching rule: a month whose points all stand alone is a month
 * that looks like a list. If the ordering would leave fewer than two points
 * carrying records of their own, ones that do are pulled up into the five,
 * replacing the ones that do not. Nothing is invented to make this true — a
 * month with only one such progression keeps only one.
 */
export function selectMonthPoints(
  progressions: readonly MonthProgression[],
  options: SelectMonthPointsOptions | number = {}
): MonthProgression[] {
  const { watched = [], brief = [], limit = MAX_POINTS } =
    typeof options === 'number' ? { limit: options } : options;

  const watchedSet = new Set(watched);
  const briefOrder = new Map(brief.map((id, index) => [id, index]));

  const ordered = [...progressions].sort((a, b) => {
    // The brief's own choice, where it named one.
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

  const chosen = ordered.slice(0, limit);
  const branching = (list: readonly MonthProgression[]) =>
    list.filter((item) => item.evidenceLogIds.length > 0).length;

  if (branching(chosen) >= MIN_BRANCHING_POINTS) return chosen;

  const spare = ordered
    .slice(limit)
    .filter((item) => item.evidenceLogIds.length > 0);

  for (const candidate of spare) {
    if (branching(chosen) >= MIN_BRANCHING_POINTS) break;
    // Drop from the back: the last of the five is the least of the month.
    const replaceable = [...chosen]
      .reverse()
      .find((item) => item.evidenceLogIds.length === 0);
    if (!replaceable) break;
    chosen[chosen.indexOf(replaceable)] = candidate;
  }

  return chosen;
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

  const points = selectMonthPoints(progressions, {
    watched,
    // The brief's order, with its lead first — it read the direction to
    // arrive at both.
    brief: lead?.leadProgressionId
      ? [lead.leadProgressionId, ...lead.points.filter((id) => id !== lead.leadProgressionId)]
      : (lead?.points ?? []),
  });
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
      // Only the first point explains itself. §13 forbids telling someone
      // they have changed, so this says why the month opens here, and the
      // other four are left to be read.
      ...(index === 0 && (lead?.leadReason || item.progression.summary)
        ? { summary: lead?.leadReason || item.progression.summary }
        : {}),
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

    layoutBranches({
      node: nodes[nodes.length - 1] as ProgressionNode,
      logIds: item.evidenceLogIds,
      rng,
      reach,
      edges,
      out: steps,
    });
  });

  // Emphasis only. Opening a point used to grow the picture a level deeper;
  // now it opens the sheet and the sky stays where it was.
  if (expandedId) {
    for (const node of nodes) {
      if (node.id !== expandedId) continue;
      node.glow = Math.min(1, node.glow + 0.25);
    }
  }

  return { me, progressions: nodes, steps, edges };
}

/**
 * The month's records for one point, fanned out beyond it.
 *
 * A fan rather than a chain: each record answers to the point it moved, not to
 * the record before it. Chained, the picture grew a level for every record and
 * a busy month reached off the canvas; fanned, the depth is fixed at three no
 * matter how much was written.
 */
function layoutBranches({
  node,
  logIds,
  rng,
  reach,
  edges,
  out,
}: {
  node: ProgressionNode;
  logIds: readonly string[];
  rng: () => number;
  reach: number;
  edges: GraphEdge[];
  out: StepNode[];
}): void {
  const shown = logIds.slice(0, MAX_BRANCHES_PER_POINT);
  if (shown.length === 0) return;

  const gap = Math.max(16, Math.min(30, reach * 0.22));
  // The fan opens along the branch's own direction, so the eye keeps going
  // the way it was already going.
  const spread = shown.length === 1 ? 0 : Math.PI / 5;

  shown.forEach((logId, index) => {
    const offset =
      shown.length === 1 ? 0 : -spread / 2 + (spread / (shown.length - 1)) * index;
    const angle = node.angle + offset + (rng() - 0.5) * 0.12;
    const distance = gap * (0.8 + rng() * 0.4);

    const x = node.x + Math.cos(angle) * distance;
    const y = node.y + Math.sin(angle) * distance;

    out.push({
      id: `step:${node.id}:${logId}`,
      progressionId: node.id,
      logId,
      x,
      y,
      r: STEP_RADIUS,
    });

    edges.push({
      id: `step-edge:${node.id}:${logId}`,
      fromX: node.x,
      fromY: node.y,
      toX: x,
      toY: y,
      kind: 'step',
    });
  });
}
