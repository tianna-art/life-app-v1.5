/**
 * The map's layout model (§16–§20).
 *
 * ME is the centre and never moves. What radiates from it is not "what I
 * wrote" but "how I have moved": the person's own words for each progression,
 * and — once one is opened — the steps it went through, in time order.
 *
 * Two rules shape everything here. Level 1 is never a type name (§17): the
 * label is the title the model wrote in the person's own vocabulary, and
 * `capability` / `strategy` never reach the screen. And nothing may read as a
 * score (§19, §20): branches are seeded and jittered so the sky looks drawn
 * rather than computed, and weight only moves a node nearer or further, never
 * ranks it in a row.
 */
import type { MonthProgression, ProgressionMaturity, ProgressionStep } from '@/types';
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

/** One step of an opened progression (§18 level 2). */
export interface StepNode {
  id: string;
  progressionId: string;
  logId: string;
  label: string;
  occurredOn: string;
  x: number;
  y: number;
  r: number;
  /** Position along the path, 0 = earliest. */
  index: number;
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
  /** The progression whose steps are showing, if any. */
  expandedId?: string | null;
  /** Steps of the expanded progression, oldest first. */
  expandedSteps?: readonly ProgressionStep[];
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

export function buildProgressionGraph({
  monthKey,
  progressions,
  expandedId = null,
  expandedSteps = [],
  width,
  height,
}: BuildProgressionGraphInput): ProgressionGraph {
  const rng = makeRng(monthKey);
  const cx = width / 2;
  const cy = height / 2;
  const me: MeNode = { x: cx, y: cy, r: ME_RADIUS };

  if (progressions.length === 0 || width <= 0 || height <= 0) {
    return { me, progressions: [], steps: [], edges: [] };
  }

  // The shortest side bounds the reach, so nothing leaves the canvas on a
  // narrow phone; the inner margin keeps the first ring clear of ME.
  const reach = Math.min(width, height) / 2 - NODE_MAX_RADIUS * 4;
  const inner = reach * 0.42;
  const span = reach - inner;

  const slice = (Math.PI * 2) / progressions.length;
  // A whole-sky offset so two months with the same count are not the same
  // picture, and no branch points straight up by default.
  const rotation = rng() * Math.PI * 2;

  const nodes: ProgressionNode[] = [];
  const edges: GraphEdge[] = [];

  progressions.forEach((item, index) => {
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
  });

  const steps = expandedId
    ? layoutSteps({
        node: nodes.find((n) => n.id === expandedId) ?? null,
        steps: expandedSteps,
        rng,
        reach,
        edges,
      })
    : [];

  return { me, progressions: nodes, steps, edges };
}

/**
 * The steps of an opened progression, laid out as a trail continuing outward.
 *
 * They read left-to-right in time along the branch's own direction, so opening
 * a node extends the line the eye already followed rather than replacing the
 * picture with a different one. The small perpendicular wander is what keeps
 * it from looking like a ruler.
 */
function layoutSteps({
  node,
  steps,
  rng,
  reach,
  edges,
}: {
  node: ProgressionNode | null;
  steps: readonly ProgressionStep[];
  rng: () => number;
  reach: number;
  edges: GraphEdge[];
}): StepNode[] {
  if (!node || steps.length === 0) return [];

  const out: StepNode[] = [];
  const gap = Math.max(14, Math.min(26, reach / (steps.length + 2)));
  const dirX = Math.cos(node.angle);
  const dirY = Math.sin(node.angle);
  // Perpendicular to the branch: the axis the wander happens on.
  const perpX = -dirY;
  const perpY = dirX;

  let previousX = node.x;
  let previousY = node.y;

  steps.forEach((step, index) => {
    const along = gap * (index + 1);
    const wander = (rng() - 0.5) * gap * 0.7;
    const x = node.x + dirX * along + perpX * wander;
    const y = node.y + dirY * along + perpY * wander;

    out.push({
      id: `step:${node.id}:${step.logId}`,
      progressionId: node.id,
      logId: step.logId,
      label: step.eventSummary,
      occurredOn: step.occurredOn,
      x,
      y,
      r: STEP_RADIUS,
      index,
    });

    edges.push({
      id: `step-edge:${node.id}:${step.logId}`,
      fromX: previousX,
      fromY: previousY,
      toX: x,
      toY: y,
      kind: 'step',
    });

    previousX = x;
    previousY = y;
  });

  return out;
}
