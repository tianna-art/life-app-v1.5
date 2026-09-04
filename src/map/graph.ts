/**
 * MAP graph model: 自分 → カテゴリー → 記録.
 *
 * Structure follows the reference graph (m-note.uk): one self node at the
 * centre, themes radiating from it, and leaves that appear only when their
 * parent is expanded. The simulation is run to rest off-frame and the result
 * is rendered as SVG — a live per-frame force loop is what makes these graphs
 * expensive on a phone, and nothing here needs to be live.
 *
 * Node size follows information volume (area ∝ characters written), so a month
 * you had a lot to say about is visibly larger. That is a shape, not a score:
 * no number derived from it is ever shown.
 */
import type { Category, LogWithAnalysis } from '@/types';
import { buildSemanticEdges } from '@/utils/similarity';

export type GraphNodeKind = 'self' | 'category' | 'log';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  parentId: string | null;
  /** Radius in layout units. */
  r: number;
  x: number;
  y: number;
  /** Payload ids so the UI can act on a tap. */
  categoryId?: string;
  logId?: string;
  logType?: 'event' | 'thought';
  /** 0..1 — how much was written here relative to its siblings. Never shown. */
  weight: number;
  /** Leaf count, for the collapsed hint ring. */
  childCount: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: 'tree' | 'semantic';
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BuildGraphInput {
  periodKey: string;
  categories: Category[];
  logs: LogWithAnalysis[];
  /** Category ids whose logs are shown. Everything else stays collapsed. */
  expanded: ReadonlySet<string>;
  width: number;
  height: number;
}

const SELF_ID = 'self';

/** Deterministic PRNG so the same period always settles into the same shape. */
function makeRng(seed: string): () => number {
  let h = 2166136261 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Area ∝ volume, so radius is a square root. Clamped to a legible span. */
function radiusFor(volume: number, maxVolume: number, min: number, max: number): number {
  if (maxVolume <= 0) return min;
  return min + (max - min) * Math.sqrt(Math.min(1, volume / maxVolume));
}

export function buildGraph({
  periodKey,
  categories,
  logs,
  expanded,
  width,
  height,
}: BuildGraphInput): Graph {
  const rng = makeRng(`${periodKey}:${logs.length}:${[...expanded].sort().join(',')}`);

  const byCategory = new Map<string, LogWithAnalysis[]>();
  for (const log of logs) {
    const list = byCategory.get(log.categoryId);
    if (list) list.push(log);
    else byCategory.set(log.categoryId, [log]);
  }

  // Only categories actually used in this period. Nothing implies a gap.
  const used = categories.filter((c) => (byCategory.get(c.id)?.length ?? 0) > 0);

  const volumeOf = (list: LogWithAnalysis[]) =>
    list.reduce((total, l) => total + l.body.length, 0);
  const categoryVolumes = used.map((c) => volumeOf(byCategory.get(c.id) ?? []));
  const maxCategoryVolume = Math.max(1, ...categoryVolumes);
  const maxLogVolume = Math.max(1, ...logs.map((l) => l.body.length));

  const cx = width / 2;
  const cy = height / 2;
  const ring = Math.min(width, height) * 0.26;

  const nodes: GraphNode[] = [
    {
      id: SELF_ID,
      kind: 'self',
      label: '',
      parentId: null,
      r: 13,
      x: cx,
      y: cy,
      weight: 1,
      childCount: used.length,
    },
  ];
  const edges: GraphEdge[] = [];

  used.forEach((category, index) => {
    const list = byCategory.get(category.id) ?? [];
    const volume = volumeOf(list);
    const angle = (index / used.length) * Math.PI * 2 - Math.PI / 2 + (rng() - 0.5) * 0.28;
    const distance = ring * (0.9 + rng() * 0.24);

    nodes.push({
      id: `c:${category.id}`,
      kind: 'category',
      label: category.name,
      parentId: SELF_ID,
      categoryId: category.id,
      r: radiusFor(volume, maxCategoryVolume, 11, 19),
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      weight: volume / maxCategoryVolume,
      childCount: list.length,
    });
    edges.push({ id: `t:${category.id}`, from: SELF_ID, to: `c:${category.id}`, kind: 'tree' });

    if (!expanded.has(category.id)) return;

    const leafRing = ring * 0.62;
    list.forEach((log, leafIndex) => {
      const spread = Math.PI * 0.9;
      const a =
        angle - spread / 2 + (list.length === 1 ? spread / 2 : (leafIndex / (list.length - 1)) * spread);
      const d = leafRing * (0.78 + rng() * 0.42);
      nodes.push({
        id: `l:${log.id}`,
        kind: 'log',
        label: log.body,
        parentId: `c:${category.id}`,
        logId: log.id,
        logType: log.type,
        r: radiusFor(log.body.length, maxLogVolume, 4, 8),
        x: cx + Math.cos(angle) * distance + Math.cos(a) * d,
        y: cy + Math.sin(angle) * distance + Math.sin(a) * d,
        weight: log.body.length / maxLogVolume,
        childCount: 0,
      });
      edges.push({ id: `t:${log.id}`, from: `c:${category.id}`, to: `l:${log.id}`, kind: 'tree' });
    });
  });

  settle(nodes, edges, width, height);

  // Meaning links between visible logs, drawn faintly and capped per log.
  const visibleLogIds = new Set(
    nodes.filter((n) => n.kind === 'log').map((n) => n.logId as string)
  );
  for (const edge of buildSemanticEdges(logs.filter((l) => visibleLogIds.has(l.id)))) {
    edges.push({
      id: `s:${edge.sourceLogId}:${edge.targetLogId}`,
      from: `l:${edge.sourceLogId}`,
      to: `l:${edge.targetLogId}`,
      kind: 'semantic',
    });
  }

  return { nodes, edges };
}

/**
 * Relax the layout: nodes repel, tree edges pull toward a rest length, and
 * everything drifts gently toward the centre. Runs to rest here rather than
 * animating, so the render is a plain SVG draw.
 */
function settle(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const self = byId.get(SELF_ID);
  const restFor = (edge: GraphEdge) => (edge.to.startsWith('c:') ? 108 : 46);

  for (let step = 0; step < 220; step += 1) {
    const alpha = 1 - step / 220;

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!a || a.kind === 'self') continue;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (!b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.01 || d2 > 160000) continue;
        const d = Math.sqrt(d2);
        const push = ((a.r + b.r + 26) ** 2 / d2) * 0.9 * alpha;
        const ux = (dx / d) * push;
        const uy = (dy / d) * push;
        a.x -= ux;
        a.y -= uy;
        if (b.kind !== 'self') {
          b.x += ux;
          b.y += uy;
        }
      }
    }

    for (const edge of edges) {
      if (edge.kind !== 'tree') continue;
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const pull = (d - restFor(edge)) * 0.14 * alpha;
      const ux = (dx / d) * pull;
      const uy = (dy / d) * pull;
      if (a.kind !== 'self') {
        a.x += ux;
        a.y += uy;
      }
      b.x -= ux;
      b.y -= uy;
    }

    if (self) {
      self.x = width / 2;
      self.y = height / 2;
    }
  }

  const margin = 26;
  for (const node of nodes) {
    node.x = Math.min(width - margin, Math.max(margin, node.x));
    node.y = Math.min(height - margin - 14, Math.max(margin, node.y));
  }
}
