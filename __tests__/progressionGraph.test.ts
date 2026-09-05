import {
  MAX_BRANCHES_PER_POINT,
  MAX_POINTS,
  MAX_POINTS_AFTER_MERGE,
  MIN_BRANCHES_PER_POINT,
  buildProgressionGraph,
  selectMonthPoints,
} from '../src/map/progressionGraph';
import type { MonthMap, MonthMapBranch, MonthProgression } from '../src/types';

const size = { width: 360, height: 400 };

const item = (
  id: string,
  evidence: string[],
  extra: Partial<MonthProgression['progression']> = {}
): MonthProgression =>
  ({
    progression: {
      id,
      userId: 'u1',
      type: 'method',
      title: id,
      summary: `${id} のまとめ`,
      maturity: 'signal',
      confidence: 0.5,
      goalExternal: false,
      firstDetectedAt: '2026-09-01T00:00:00.000Z',
      lastUpdatedAt: '2026-09-01T00:00:00.000Z',
      userEdited: false,
      evidenceCount: evidence.length,
      ...extra,
    },
    evidenceLogIds: evidence,
    isNew: false,
    maturityThen: 'signal',
  }) as MonthProgression;

const branch = (label: string, logIds: string[]): MonthMapBranch => ({
  label,
  summary: `${label}の理由`,
  logIds,
});

/** A brief that can tell each named point apart into two things. */
const brief = (
  points: Record<string, MonthMapBranch[]>,
  lead?: string
): MonthMap => ({
  periodKey: '2026-09',
  ...(lead ? { leadProgressionId: lead } : {}),
  leadReason: 'なりたい姿に近い記録が続いています',
  points: Object.entries(points).map(([progressionId, branches]) => ({
    progressionId,
    branches,
  })),
  generatedAt: '2026-09-30T00:00:00.000Z',
});

const tellable = (ids: string[], lead?: string) =>
  brief(
    Object.fromEntries(
      ids.map((id) => [id, [branch(`${id}-a`, ['l1']), branch(`${id}-b`, ['l2'])]])
    ),
    lead
  );

describe("a month's map", () => {
  it('lets at most five points leave ME', () => {
    const many = Array.from({ length: 9 }, (_, i) => item(`p${i}`, [`l${i}`]));
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: many,
      lead: tellable(many.map((m) => m.progression.id)),
      ...size,
    });
    expect(graph.progressions).toHaveLength(MAX_POINTS);
  });

  it('drops a point it cannot tell apart into two things', () => {
    // One branch is the point restated. It belongs inside another point,
    // not beside it.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('two', ['a']), item('one', ['b'])],
      lead: brief(
        {
          two: [branch('x', ['a']), branch('y', ['b'])],
          one: [branch('z', ['b'])],
        },
        'two'
      ),
      ...size,
    });
    expect(graph.progressions.map((n) => n.id)).toEqual(['two']);
    expect(MIN_BRANCHES_PER_POINT).toBe(2);
  });

  it('does not refill the space a folded point left', () => {
    // Merging is meant to reduce, so a map that had to drop one caps lower
    // rather than pulling the next candidate up.
    const many = Array.from({ length: 8 }, (_, i) => item(`p${i}`, [`l${i}`]));
    const b = tellable(many.map((m) => m.progression.id));
    b.points[7] = { progressionId: 'p7', branches: [branch('alone', ['l7'])] };
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: many,
      lead: b,
      ...size,
    });
    expect(graph.progressions.length).toBeLessThanOrEqual(MAX_POINTS_AFTER_MERGE);
  });

  it('shows what is under a point only once it is opened', () => {
    const progressions = [item('p1', ['a', 'b'])];
    const lead = tellable(['p1']);
    const shut = buildProgressionGraph({ monthKey: '2026-09', progressions, lead, ...size });
    expect(shut.steps).toHaveLength(0);

    const open = buildProgressionGraph({
      monthKey: '2026-09',
      progressions,
      lead,
      expandedId: 'p1',
      ...size,
    });
    expect(open.steps).toHaveLength(2);
  });

  it('never goes deeper than three levels', () => {
    // ME, the points, what is under one. Each branch answers to its point,
    // never to the branch before it.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('p1', ['a', 'b'])],
      lead: tellable(['p1']),
      expandedId: 'p1',
      ...size,
    });
    const point = graph.progressions[0];
    for (const edge of graph.edges.filter((e) => e.kind === 'step')) {
      expect(edge.fromX).toBeCloseTo(point?.x ?? -1, 5);
      expect(edge.fromY).toBeCloseTo(point?.y ?? -1, 5);
    }
  });

  it('stops fanning a point once it stops being legible', () => {
    const six = Array.from({ length: 6 }, (_, i) => branch(`b${i}`, [`l${i}`]));
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('p1', ['a'])],
      lead: brief({ p1: six }, 'p1'),
      expandedId: 'p1',
      ...size,
    });
    expect(graph.steps).toHaveLength(MAX_BRANCHES_PER_POINT);
  });

  it('carries the records a branch was read from, so it stays checkable', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('p1', ['a'])],
      lead: brief({ p1: [branch('x', ['l1', 'l2']), branch('y', ['l3'])] }, 'p1'),
      expandedId: 'p1',
      ...size,
    });
    expect(graph.steps.map((s) => s.logIds)).toEqual([['l1', 'l2'], ['l3']]);
    expect(graph.steps.every((s) => s.logIds.length > 0)).toBe(true);
  });

  it('leads with what this month actually holds, before any brief exists', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [
        item('touched-once', ['a'], { confidence: 0.99 }),
        item('this-month', ['a', 'b', 'c'], { confidence: 0.1 }),
      ],
      ...size,
    });
    expect(graph.progressions[0]?.id).toBe('this-month');
  });

  it('puts a point the cards made worth watching ahead of a busier one', () => {
    // §19: the lens raises priority. It is what makes the points about what
    // the person said they wanted rather than about who wrote the most.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [
        item('busier', ['a', 'b', 'c'], { pattern: 'repeat' }),
        item('watched', ['d'], { pattern: 'expose' }),
      ],
      watched: ['expose'],
      ...size,
    });
    expect(graph.progressions[0]?.id).toBe('watched');
  });

  it('keeps what grew outside the direction (§19)', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('outside', ['a', 'b'], { pattern: 'repeat' })],
      watched: ['expose', 'own_call'],
      ...size,
    });
    expect(graph.progressions.map((n) => n.id)).toEqual(['outside']);
  });

  it('lets the brief choose which points, not only which is first', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`p${i}`, [`l${i}`]));
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: many,
      lead: tellable(['p7', 'p6', 'p5'], 'p7'),
      ...size,
    });
    expect(graph.progressions.map((n) => n.id)).toEqual(['p7', 'p6', 'p5']);
  });

  it('will not let a sentence put a point on a map it has no records on', () => {
    // The brief decides the order; the month decides who is eligible.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('here', ['a'])],
      lead: tellable(['not-in-this-month', 'here'], 'not-in-this-month'),
      ...size,
    });
    expect(graph.progressions.map((n) => n.id)).toEqual(['here']);
  });

  it('leaves the sentence about the month to the month itself', () => {
    // It sits under SEPTEMBER 2026, not on the canvas.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('lead', ['a', 'b'])],
      lead: tellable(['lead'], 'lead'),
      ...size,
    });
    expect(JSON.stringify(graph.progressions)).not.toContain('なりたい姿');
  });

  it('draws the same month the same way twice', () => {
    const build = () =>
      buildProgressionGraph({
        monthKey: '2026-09',
        progressions: [item('p1', ['a']), item('p2', ['b'])],
        lead: tellable(['p1', 'p2']),
        expandedId: 'p1',
        ...size,
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('orders on the month alone when nothing has briefed it', () => {
    const chosen = selectMonthPoints([item('a', ['1']), item('b', ['1', '2'])]);
    expect(chosen.map((c) => c.progression.id)).toEqual(['b', 'a']);
  });
});
