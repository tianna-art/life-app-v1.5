/**
 * The map's layout model (§13–§16).
 *
 * ME is the centre and never moves. What radiates from it is not "what I
 * wrote" but "what has grown in me": gain types, then the person's own gains,
 * then — only once a gain is opened — the records that stand behind it.
 *
 * The arrangement is seeded per month so the same month always settles into
 * the same sky, and jittered so it reads as an old celestial chart rather than
 * an org diagram. Node size follows maturity, which is a shape and never a
 * number the person is shown.
 */
import type { GainMaturity, GainType } from '@/types';
import type { MonthGain } from '@/data/repository';
import { GAIN_TYPES, MATURITY_OPACITY } from '@/constants/gain';

export interface MeNode {
  x: number;
  y: number;
  r: number;
}

export interface TypeBranch {
  type: GainType;
  /** Where the small plate sits, part-way out along the branch. */
  x: number;
  y: number;
  angle: number;
}

export interface GainNode {
  id: string;
  type: GainType;
  label: string;
  maturity: GainMaturity;
  x: number;
  y: number;
  r: number;
  /** 0..1 light, from maturity. Never rendered as a value. */
  glow: number;
  isNew: boolean;
  hasVerdict: boolean;
  evidenceCount: number;
}

export interface EvidenceNode {
  id: string;
  gainId: string;
  logId: string;
  x: number;
  y: number;
  r: number;
}

export interface GainGraphEdge {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: 'branch' | 'twig';
}

export interface GainGraph {
  me: MeNode;
  branches: TypeBranch[];
  gains: GainNode[];
  evidence: EvidenceNode[];
  edges: GainGraphEdge[];
}

export interface BuildGainGraphInput {
  monthKey: string;
  gains: readonly MonthGain[];
  /** The gain whose records are showing, if any. */
  expandedGainId?: string | null;
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

const MATURITY_RADIUS: Record<GainMaturity, number> = {
  signal: 3.4,
  attempt: 4.4,
  emerging: 5.6,
  evidenced: 7,
  established: 8.6,
};

export function buildGainGraph({
  monthKey,
  gains,
  expandedGainId = null,
  width,
  height,
}: BuildGainGraphInput): GainGraph {
  const rng = makeRng(`${monthKey}:${gains.length}:${expandedGainId ?? ''}`);
  const cx = width / 2;
  const cy = height / 2;
  // An ellipse, not a circle: a phone canvas is far taller than it is wide, and
  // a circular ring wastes the top and bottom of the sky while crowding the
  // sides. `ring` stays the short radius that leaf distances are scaled by.
  const rx = width * 0.33;
  const ry = height * 0.29;
  const ring = Math.min(rx, ry);

  const me: MeNode = { x: cx, y: cy, r: 13 };

  // Only the types the person actually has. An absent type is absent — the map
  // never shows six empty spokes waiting to be filled in (§15).
  const byType = new Map<GainType, MonthGain[]>();
  for (const item of gains) {
    const list = byType.get(item.gain.type);
    if (list) list.push(item);
    else byType.set(item.gain.type, [item]);
  }
  const presentTypes = GAIN_TYPES.filter((type) => (byType.get(type)?.length ?? 0) > 0);

  const branches: TypeBranch[] = [];
  const gainNodes: GainNode[] = [];
  const evidenceNodes: EvidenceNode[] = [];
  const edges: GainGraphEdge[] = [];

  presentTypes.forEach((type, index) => {
    const list = [...(byType.get(type) ?? [])].sort(
      (a, b) =>
        b.evidenceLogIds.length - a.evidenceLogIds.length ||
        a.gain.label.localeCompare(b.gain.label)
    );

    // Slots around the circle, nudged so nothing lands dead-vertical.
    const base = (index / presentTypes.length) * Math.PI * 2 - Math.PI / 2;
    const angle = base + (rng() - 0.5) * 0.34;

    // The small plate sits part-way out along the branch, far enough from the
    // centre that it never collides with ME's own label.
    const plateX = cx + Math.cos(angle) * rx * 0.5;
    const plateY = cy + Math.sin(angle) * ry * 0.5;
    const plateDistance = Math.hypot(plateX - cx, plateY - cy) || 1;
    const plateScale = plateDistance < 78 ? 78 / plateDistance : 1;
    branches.push({
      type,
      angle,
      x: cx + (plateX - cx) * plateScale,
      y: cy + (plateY - cy) * plateScale,
    });

    const spread = Math.min(Math.PI * 0.7, 0.42 + list.length * 0.26);
    list.forEach((item, gainIndex) => {
      const offset =
        list.length === 1
          ? 0
          : -spread / 2 + (gainIndex / (list.length - 1)) * spread;
      const a = angle + offset + (rng() - 0.5) * 0.1;
      // Siblings sit at different depths, so a fan of three never reads as a row.
      const depth = 0.92 + (gainIndex % 3) * 0.16 + rng() * 0.2;
      const x = cx + Math.cos(a) * rx * depth;
      const y = cy + Math.sin(a) * ry * depth;

      const node: GainNode = {
        id: item.gain.id,
        type,
        label: item.gain.label,
        maturity: item.gain.maturity,
        x,
        y,
        r: MATURITY_RADIUS[item.gain.maturity],
        glow: MATURITY_OPACITY[item.gain.maturity],
        isNew: item.isNew,
        hasVerdict: Boolean(item.gain.verdict),
        evidenceCount: item.evidenceLogIds.length,
      };
      gainNodes.push(node);
      edges.push({
        id: `b:${item.gain.id}`,
        fromX: me.x,
        fromY: me.y,
        toX: x,
        toY: y,
        kind: 'branch',
      });

      if (expandedGainId !== item.gain.id) return;

      // Level 3: the records behind this gain, as small stars (§15).
      const leafSpread = Math.PI * 0.7;
      item.evidenceLogIds.forEach((logId, leafIndex) => {
        const la =
          a -
          leafSpread / 2 +
          (item.evidenceLogIds.length === 1
            ? leafSpread / 2
            : (leafIndex / (item.evidenceLogIds.length - 1)) * leafSpread);
        const ld = ring * (0.34 + rng() * 0.2);
        const lx = x + Math.cos(la) * ld;
        const ly = y + Math.sin(la) * ld;
        evidenceNodes.push({
          id: `e:${item.gain.id}:${logId}`,
          gainId: item.gain.id,
          logId,
          x: lx,
          y: ly,
          r: 2.2,
        });
        edges.push({
          id: `t:${item.gain.id}:${logId}`,
          fromX: x,
          fromY: y,
          toX: lx,
          toY: ly,
          kind: 'twig',
        });
      });
    });
  });

  relax(gainNodes, evidenceNodes, me);
  clampToCanvas(gainNodes, evidenceNodes, branches, width, height);
  rewireEdges(edges, me, gainNodes, evidenceNodes);

  return { me, branches, gains: gainNodes, evidence: evidenceNodes, edges };
}

/**
 * A few passes of mutual repulsion so labels do not collide. Run to rest here
 * rather than animated: a live force loop is what makes graphs expensive on a
 * phone, and nothing about this picture needs to move.
 */
function relax(gains: GainNode[], evidence: EvidenceNode[], me: MeNode): void {
  // What collides is the label, not the dot: a gain occupies a small plaque of
  // text, so separation is computed from that box rather than from the radius.
  const movable = [
    ...gains.map((g) => ({ x: g.x, y: g.y, keepOut: 52 })),
    ...evidence.map((e) => ({ x: e.x, y: e.y, keepOut: 13 })),
  ];

  for (let step = 0; step < 140; step += 1) {
    const alpha = 1 - step / 140;
    for (let i = 0; i < movable.length; i += 1) {
      const a = movable[i];
      if (!a) continue;
      for (let j = i + 1; j < movable.length; j += 1) {
        const b = movable[j];
        if (!b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.01 || d2 > 90000) continue;
        const d = Math.sqrt(d2);
        const want = a.keepOut + b.keepOut;
        if (d >= want) continue;
        const push = ((want - d) / 2) * 0.7 * alpha;
        const ux = (dx / d) * push;
        const uy = (dy / d) * push;
        a.x -= ux;
        a.y -= uy;
        b.x += ux;
        b.y += uy;
      }
      // Nothing is allowed to drift onto the centre plate.
      const mdx = a.x - me.x;
      const mdy = a.y - me.y;
      const md = Math.hypot(mdx, mdy) || 0.01;
      const minDistance = me.r + a.keepOut + 26;
      if (md < minDistance) {
        a.x = me.x + (mdx / md) * minDistance;
        a.y = me.y + (mdy / md) * minDistance;
      }
    }
  }

  movable.forEach((moved, index) => {
    const target = index < gains.length ? gains[index] : evidence[index - gains.length];
    if (!target) return;
    target.x = moved.x;
    target.y = moved.y;
  });
}

function clampToCanvas(
  gains: GainNode[],
  evidence: EvidenceNode[],
  branches: TypeBranch[],
  width: number,
  height: number
): void {
  const margin = 44;
  for (const node of [...gains, ...evidence, ...branches] as Array<{ x: number; y: number }>) {
    node.x = Math.min(width - margin, Math.max(margin, node.x));
    node.y = Math.min(height - margin, Math.max(margin, node.y));
  }
}

/** Relaxation moved the nodes; the lines follow them. */
function rewireEdges(
  edges: GainGraphEdge[],
  me: MeNode,
  gains: GainNode[],
  evidence: EvidenceNode[]
): void {
  const gainById = new Map(gains.map((g) => [g.id, g]));
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  for (const edge of edges) {
    if (edge.kind === 'branch') {
      const gain = gainById.get(edge.id.slice(2));
      if (!gain) continue;
      edge.fromX = me.x;
      edge.fromY = me.y;
      edge.toX = gain.x;
      edge.toY = gain.y;
    } else {
      const leaf = evidenceById.get(`e:${edge.id.slice(2)}`);
      const gain = gainById.get(edge.id.slice(2).split(':')[0] ?? '');
      if (!leaf || !gain) continue;
      edge.fromX = gain.x;
      edge.fromY = gain.y;
      edge.toX = leaf.x;
      edge.toY = leaf.y;
    }
  }
}
