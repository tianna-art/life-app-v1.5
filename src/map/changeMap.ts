/**
 * The map's layout (§18–§21, §44).
 *
 * ME is the centre and never moves. What radiates from it is not what the
 * person wrote about but what changed: two to five points, each one a
 * published change, each labelled with what moved rather than what it was
 * about.
 *
 * Two levels, and that is the whole picture. There used to be a third — every
 * point fanned out into branches, and a point that could not be split into two
 * was folded away to force it. §21 says the opposite and is right: branching
 * the records do not support is invention, and a point whose parts are
 * genuinely separate changes should stand beside the others rather than hang
 * as a twig under one. What used to be a branch is now the evidence list on
 * the card, which is where records belong.
 *
 * Nothing here may read as a score (§45). Weight moves a point nearer or
 * further and lightens it; it never puts points in a row, and the spread
 * between the least and most settled is smaller than the jitter between
 * neighbours.
 */
import type { Change } from '@/types';

export interface MeNode {
  x: number;
  y: number;
  r: number;
}

export interface ChangeNode {
  id: string;
  /** What changed, in the person's words. The card's heading is this string. */
  title: string;
  x: number;
  y: number;
  r: number;
  /** 0..1 light. Never rendered as a value. */
  glow: number;
  angle: number;
  selected: boolean;
}

export interface GraphEdge {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface ChangeMapGraph {
  me: MeNode;
  nodes: ChangeNode[];
  edges: GraphEdge[];
}

export interface BuildChangeMapInput {
  monthKey: string;
  changes: readonly Change[];
  /** The card the person is looking at, lit brighter than the rest (§24). */
  selectedId?: string | null;
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
const NODE_MIN_RADIUS = 4;
const NODE_MAX_RADIUS = 7.5;

/**
 * §20. Two to five, and the lower bound is not a minimum to reach.
 *
 * A month with one change draws one point, and a month with none draws ME
 * alone. Filling the sky to five would mean promoting changes that did not
 * clear §43, which is the one failure the person can catch the app in.
 */
export const MAX_NODES = 5;

/** §17 decides the light: more behind a change, more of it. */
const GLOW: Record<Change['confidence'], number> = {
  signal: 0.42,
  supported: 0.68,
  strong: 0.92,
};

function weightOf(change: Change): number {
  const evidence = Math.min(1, change.evidence.length / 5);
  const settled = GLOW[change.confidence];
  // Agreeing pulls a change closer; correcting it does the same, because a
  // corrected one is the person's own and matters more, not less.
  const confirmed = change.verdict ? 0.12 : 0;
  return Math.min(1, evidence * 0.35 + settled * 0.53 + confirmed);
}

export function buildChangeMap({
  monthKey,
  changes,
  selectedId = null,
  width,
  height,
}: BuildChangeMapInput): ChangeMapGraph {
  const rng = makeRng(monthKey);
  const cx = width / 2;
  const cy = height / 2;
  const me: MeNode = { x: cx, y: cy, r: ME_RADIUS };

  const points = changes.slice(0, MAX_NODES);
  if (points.length === 0 || width <= 0 || height <= 0) {
    return { me, nodes: [], edges: [] };
  }

  // The shortest side bounds the reach so nothing leaves the canvas on a
  // narrow phone; the inner margin keeps the ring clear of ME, and the outer
  // margin leaves room for a two-line title under each point.
  const reach = (Math.min(width, height) / 2 - NODE_MAX_RADIUS * 3) * 0.72;
  const inner = reach * 0.46;
  const span = reach - inner;

  const slice = (Math.PI * 2) / points.length;
  // A whole-sky offset, so two months with the same count are not the same
  // picture and nothing points straight up by default.
  const rotation = rng() * Math.PI * 2;

  const nodes: ChangeNode[] = [];
  const edges: GraphEdge[] = [];

  points.forEach((change, index) => {
    const weight = weightOf(change);
    // Jitter inside the slice, never across it, so two points cannot collide.
    const angle = rotation + slice * index + (rng() - 0.5) * slice * 0.5;
    // More weight sits nearer the centre: closer to ME is closer to settled.
    const distance = inner + span * (1 - weight) * (0.5 + rng() * 0.5);

    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const selected = selectedId === change.id;

    nodes.push({
      id: change.id,
      title: change.title,
      x,
      y,
      r: NODE_MIN_RADIUS + (NODE_MAX_RADIUS - NODE_MIN_RADIUS) * weight,
      glow: selected ? Math.min(1, GLOW[change.confidence] + 0.25) : GLOW[change.confidence],
      angle,
      selected,
    });

    edges.push({ id: `edge:${change.id}`, fromX: cx, fromY: cy, toX: x, toY: y });
  });

  return { me, nodes, edges };
}
