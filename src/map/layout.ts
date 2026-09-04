/**
 * MAP layout (spec §10).
 *
 * Deterministic: the same period + same logs always produce the same sky, so
 * the map does not reshuffle on every render. Randomness comes from a seeded
 * PRNG keyed by ids, never from Math.random().
 */
import type { Category, LogWithAnalysis } from '@/types';
import { buildSemanticEdges, type SemanticEdge } from '@/utils/similarity';
import { monthKeyOfDate } from '@/utils/period';

export interface Vec {
  x: number;
  y: number;
}

export interface CategoryNode extends Vec {
  kind: 'category';
  categoryId: string;
  name: string;
  /** 0..1 — relative weight by log count, drives glyph size only. Never shown. */
  weight: number;
  logCount: number;
  radius: number;
}

export interface LogNode extends Vec {
  kind: 'log';
  logId: string;
  categoryId: string;
  type: 'event' | 'thought';
  radius: number;
}

export interface MonthNode extends Vec {
  kind: 'month';
  categoryId: string;
  monthKey: string;
  label: string;
  logCount: number;
  radius: number;
}

export type MapNode = CategoryNode | LogNode | MonthNode;

export interface MapEdge {
  from: Vec;
  to: Vec;
  variant: 'membership' | 'semantic';
  key: string;
}

export interface MapLayout {
  width: number;
  height: number;
  categoryNodes: CategoryNode[];
  logNodes: LogNode[];
  monthNodes: MonthNode[];
  edges: MapEdge[];
  /** Decorative background stars — never interactive, never data. */
  dust: Array<Vec & { r: number; o: number }>;
}

/** Mulberry32 — small, fast, deterministic. */
function makeRng(seedText: string): () => number {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Light collision relaxation (spec §10.1 step 6). Pushes overlapping nodes
 * apart while pinning category nodes, so clusters stay legible without a
 * physics dependency.
 */
function relax(
  movable: Array<Vec & { radius: number }>,
  pinned: Array<Vec & { radius: number }>,
  bounds: { width: number; height: number },
  iterations = 42
): void {
  const pad = 6;
  for (let step = 0; step < iterations; step += 1) {
    for (let i = 0; i < movable.length; i += 1) {
      const a = movable[i];
      if (!a) continue;
      const others: Array<Vec & { radius: number }> = [...pinned];
      for (let j = 0; j < movable.length; j += 1) if (j !== i && movable[j]) others.push(movable[j]!);
      for (const b of others) {
        const d = dist(a, b);
        const min = a.radius + b.radius + pad;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const ux = (a.x - b.x) / d;
          const uy = (a.y - b.y) / d;
          a.x += ux * push;
          a.y += uy * push;
        }
      }
      a.x = Math.min(bounds.width - a.radius - 8, Math.max(a.radius + 8, a.x));
      a.y = Math.min(bounds.height - a.radius - 8, Math.max(a.radius + 8, a.y));
    }
  }
}

function buildDust(rng: () => number, width: number, height: number, count: number) {
  return Array.from({ length: count }, () => ({
    x: rng() * width,
    y: rng() * height,
    r: 0.4 + rng() * 1.1,
    o: 0.08 + rng() * 0.22,
  }));
}

/**
 * Place category nodes on an asymmetric celestial arrangement rather than an
 * even circle — the spec explicitly asks for a star chart, not a pie.
 */
function placeCategories(
  categories: Array<{ id: string; name: string; logCount: number }>,
  rng: () => number,
  width: number,
  height: number,
  baseRadius: number
): CategoryNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const maxCount = Math.max(1, ...categories.map((c) => c.logCount));
  const ringR = Math.min(width, height) * 0.31;
  const n = categories.length;

  const nodes: CategoryNode[] = categories.map((c, i) => {
    // Golden-angle-ish spread with a seeded wobble: never a tidy clock face.
    const angle = (i / Math.max(1, n)) * Math.PI * 2 + 2.399963 * 0.18 * i + (rng() - 0.5) * 0.5;
    const rr = ringR * (n === 1 ? 0 : 0.78 + rng() * 0.42);
    const weight = c.logCount / maxCount;
    return {
      kind: 'category' as const,
      categoryId: c.id,
      name: c.name,
      weight,
      logCount: c.logCount,
      radius: baseRadius + weight * baseRadius * 0.45,
      x: cx + Math.cos(angle) * rr,
      y: cy + Math.sin(angle) * rr * 1.02,
    };
  });

  // Each category owns a whole cluster (glyph + label + its ring of stars), so
  // they are pushed apart by that footprint rather than by the glyph alone.
  const clearance = (node: CategoryNode) => node.radius + 46 + Math.min(34, node.logCount * 4);
  const margin = baseRadius + 34;
  for (let step = 0; step < 60; step += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!a) continue;
      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;
        const b = nodes[j];
        if (!b) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const min = clearance(a) + clearance(b);
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2;
          a.x += ((a.x - b.x) / d) * push;
          a.y += ((a.y - b.y) / d) * push;
        }
      }
      a.x = Math.min(width - margin, Math.max(margin, a.x));
      a.y = Math.min(height - margin - 18, Math.max(margin, a.y));
    }
  }

  return nodes;
}

export interface MonthlyLayoutInput {
  periodKey: string;
  width: number;
  height: number;
  categories: Category[];
  logs: LogWithAnalysis[];
}

/**
 * Monthly sky. Only categories that actually have logs in this exact month
 * appear — no "missing category" is ever implied.
 */
export function buildMonthlyLayout({
  periodKey,
  width,
  height,
  categories,
  logs,
}: MonthlyLayoutInput): MapLayout {
  const rng = makeRng(`month:${periodKey}:${logs.length}`);

  const byCategory = new Map<string, LogWithAnalysis[]>();
  for (const log of logs) {
    const list = byCategory.get(log.categoryId);
    if (list) list.push(log);
    else byCategory.set(log.categoryId, [log]);
  }

  const used = categories
    .filter((c) => (byCategory.get(c.id)?.length ?? 0) > 0)
    .map((c) => ({ id: c.id, name: c.name, logCount: byCategory.get(c.id)?.length ?? 0 }));

  const categoryNodes = placeCategories(used, rng, width, height, 21);
  const logNodes: LogNode[] = [];

  for (const node of categoryNodes) {
    const items = byCategory.get(node.categoryId) ?? [];
    const orbit = node.radius + 34;
    items.forEach((log, index) => {
      const angle = (index / Math.max(1, items.length)) * Math.PI * 2 + rng() * 1.4;
      const r = orbit + rng() * 26 + Math.floor(index / 6) * 16;
      logNodes.push({
        kind: 'log',
        logId: log.id,
        categoryId: node.categoryId,
        type: log.type,
        radius: log.type === 'event' ? 5 : 6,
        x: node.x + Math.cos(angle) * r,
        y: node.y + Math.sin(angle) * r * 0.9,
      });
    });
  }

  relax(logNodes, categoryNodes, { width, height });

  const categoryById = new Map(categoryNodes.map((n) => [n.categoryId, n]));
  const logById = new Map(logNodes.map((n) => [n.logId, n]));

  const edges: MapEdge[] = [];
  for (const log of logNodes) {
    const target = categoryById.get(log.categoryId);
    if (target) {
      edges.push({
        from: { x: log.x, y: log.y },
        to: { x: target.x, y: target.y },
        variant: 'membership',
        key: `m:${log.logId}`,
      });
    }
  }

  for (const edge of buildSemanticEdges(logs)) {
    const a = logById.get(edge.sourceLogId);
    const b = logById.get(edge.targetLogId);
    if (!a || !b) continue;
    edges.push({
      from: { x: a.x, y: a.y },
      to: { x: b.x, y: b.y },
      variant: 'semantic',
      key: `s:${edge.sourceLogId}:${edge.targetLogId}`,
    });
  }

  return {
    width,
    height,
    categoryNodes,
    logNodes,
    monthNodes: [],
    edges,
    dust: buildDust(rng, width, height, 46),
  };
}

export interface YearlyLayoutInput {
  periodKey: string;
  width: number;
  height: number;
  categories: Category[];
  logs: LogWithAnalysis[];
  /** Log ids the user has opened; used only to pick representatives. */
  openedLogIds?: Set<string>;
  /** Log ids referenced by a confirmed monthly title. */
  titleLogIds?: Set<string>;
}

export const MAX_REPRESENTATIVE_LOGS_PER_MONTH = 3;

/** Representative score (spec §10.2). Internal ranking only, never displayed. */
export function scoreRepresentative(
  log: LogWithAnalysis,
  opened: Set<string>,
  titled: Set<string>
): number {
  const lengthScore = Math.min(1, log.body.length / 160);
  const confidence = log.analysis?.confidence ?? 0.3;
  const openedScore = opened.has(log.id) ? 1 : 0;
  const titleScore = titled.has(log.id) ? 1 : 0;
  return openedScore * 2 + titleScore * 1.5 + confidence + lengthScore * 0.5;
}

/** Yearly sky: category = large node, month = mid node, up to 3 logs each. */
export function buildYearlyLayout({
  periodKey,
  width,
  height,
  categories,
  logs,
  openedLogIds = new Set<string>(),
  titleLogIds = new Set<string>(),
}: YearlyLayoutInput): MapLayout {
  const rng = makeRng(`year:${periodKey}:${logs.length}`);

  const byCategory = new Map<string, LogWithAnalysis[]>();
  for (const log of logs) {
    const list = byCategory.get(log.categoryId);
    if (list) list.push(log);
    else byCategory.set(log.categoryId, [log]);
  }

  const used = categories
    .filter((c) => (byCategory.get(c.id)?.length ?? 0) > 0)
    .map((c) => ({ id: c.id, name: c.name, logCount: byCategory.get(c.id)?.length ?? 0 }));

  const categoryNodes = placeCategories(used, rng, width, height, 26);
  const monthNodes: MonthNode[] = [];
  const logNodes: LogNode[] = [];

  for (const node of categoryNodes) {
    const items = byCategory.get(node.categoryId) ?? [];
    const byMonth = new Map<string, LogWithAnalysis[]>();
    for (const log of items) {
      const key = monthKeyOfDate(log.occurredOn);
      const list = byMonth.get(key);
      if (list) list.push(log);
      else byMonth.set(key, [log]);
    }
    const months = [...byMonth.keys()].sort();
    months.forEach((key, index) => {
      const monthLogs = byMonth.get(key) ?? [];
      const angle = (index / Math.max(1, months.length)) * Math.PI * 2 + rng() * 0.8;
      const r = node.radius + 44 + rng() * 12;
      const mx = node.x + Math.cos(angle) * r;
      const my = node.y + Math.sin(angle) * r * 0.9;
      monthNodes.push({
        kind: 'month',
        categoryId: node.categoryId,
        monthKey: key,
        label: String(Number(key.slice(5, 7))),
        logCount: monthLogs.length,
        radius: 12,
        x: mx,
        y: my,
      });

      const representatives = [...monthLogs]
        .sort(
          (a, b) =>
            scoreRepresentative(b, openedLogIds, titleLogIds) -
              scoreRepresentative(a, openedLogIds, titleLogIds) || a.id.localeCompare(b.id)
        )
        .slice(0, MAX_REPRESENTATIVE_LOGS_PER_MONTH);

      representatives.forEach((log, ri) => {
        const a2 = angle + (ri - 1) * 0.34;
        const r2 = 22 + rng() * 8;
        logNodes.push({
          kind: 'log',
          logId: log.id,
          categoryId: node.categoryId,
          type: log.type,
          radius: log.type === 'event' ? 4 : 5,
          x: mx + Math.cos(a2) * r2,
          y: my + Math.sin(a2) * r2 * 0.9,
        });
      });
    });
  }

  relax([...monthNodes, ...logNodes], categoryNodes, { width, height }, 30);

  const categoryById = new Map(categoryNodes.map((n) => [n.categoryId, n]));
  const monthByKey = new Map(monthNodes.map((n) => [`${n.categoryId}|${n.monthKey}`, n]));

  const edges: MapEdge[] = [];
  for (const month of monthNodes) {
    const parent = categoryById.get(month.categoryId);
    if (!parent) continue;
    edges.push({
      from: { x: month.x, y: month.y },
      to: { x: parent.x, y: parent.y },
      variant: 'membership',
      key: `ym:${month.categoryId}:${month.monthKey}`,
    });
  }
  const logSource = new Map(logs.map((l) => [l.id, l]));
  for (const log of logNodes) {
    const source = logSource.get(log.logId);
    if (!source) continue;
    const parent = monthByKey.get(`${log.categoryId}|${monthKeyOfDate(source.occurredOn)}`);
    if (!parent) continue;
    edges.push({
      from: { x: log.x, y: log.y },
      to: { x: parent.x, y: parent.y },
      variant: 'membership',
      key: `yl:${log.logId}`,
    });
  }

  return {
    width,
    height,
    categoryNodes,
    logNodes,
    monthNodes,
    edges,
    dust: buildDust(rng, width, height, 60),
  };
}
