import {
  MAX_BRANCHES_PER_POINT,
  MAX_POINTS,
  MIN_BRANCHING_POINTS,
  buildProgressionGraph,
  selectMonthPoints,
} from '../src/map/progressionGraph';
import type { MonthProgression } from '../src/types';

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
      firstDetectedAt: '2026-08-01T00:00:00.000Z',
      lastUpdatedAt: '2026-08-01T00:00:00.000Z',
      userEdited: false,
      evidenceCount: evidence.length,
      ...extra,
    },
    evidenceLogIds: evidence,
    isNew: false,
    maturityThen: 'signal',
  }) as MonthProgression;

const size = { width: 360, height: 400 };

describe("a month's map", () => {
  it('lets at most five points leave ME', () => {
    const many = Array.from({ length: 9 }, (_, i) => item(`p${i}`, [`l${i}`]));
    const graph = buildProgressionGraph({ monthKey: '2026-08', progressions: many, ...size });
    expect(graph.progressions).toHaveLength(MAX_POINTS);
  });

  it('keeps at least two points carrying records of their own', () => {
    // Otherwise the month is a list of five things that happened once.
    const mixed = [
      item('alone-a', []),
      item('alone-b', []),
      item('alone-c', []),
      item('alone-d', []),
      item('alone-e', []),
      item('has-one', ['l1']),
      item('has-two', ['l2', 'l3']),
    ];
    const chosen = selectMonthPoints(mixed);
    expect(chosen.filter((p) => p.evidenceLogIds.length > 0).length).toBeGreaterThanOrEqual(
      MIN_BRANCHING_POINTS
    );
  });

  it('does not invent branching a month does not have', () => {
    const barely = [item('only', ['l1']), item('alone-a', []), item('alone-b', [])];
    const chosen = selectMonthPoints(barely);
    expect(chosen.filter((p) => p.evidenceLogIds.length > 0)).toHaveLength(1);
  });

  it('never goes deeper than three levels', () => {
    // ME, the points, the records behind a point. The records used to be a
    // chain that grew a level per record; each one now answers to its point.
    const graph = buildProgressionGraph({
      monthKey: '2026-08',
      progressions: [item('p1', ['a', 'b', 'c', 'd', 'e', 'f'])],
      ...size,
    });
    const nodeIds = new Set(graph.progressions.map((n) => n.id));
    for (const step of graph.steps) expect(nodeIds.has(step.progressionId)).toBe(true);

    // Every record's line starts at its own point, never at another record.
    const pointAt = graph.progressions[0];
    for (const edge of graph.edges.filter((e) => e.kind === 'step')) {
      expect(edge.fromX).toBeCloseTo(pointAt?.x ?? -1, 5);
      expect(edge.fromY).toBeCloseTo(pointAt?.y ?? -1, 5);
    }
  });

  it('stops fanning a point once it stops being legible', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-08',
      progressions: [item('p1', ['a', 'b', 'c', 'd', 'e', 'f', 'g'])],
      ...size,
    });
    expect(graph.steps).toHaveLength(MAX_BRANCHES_PER_POINT);
  });

  it('leads with what this month actually holds', () => {
    // A progression that ran all year and was touched once does not lead.
    const graph = buildProgressionGraph({
      monthKey: '2026-08',
      progressions: [
        item('touched-once', ['a'], { confidence: 0.99 }),
        item('this-month', ['a', 'b', 'c'], { confidence: 0.1 }),
      ],
      ...size,
    });
    expect(graph.progressions[0]?.id).toBe('this-month');
  });

  it('explains only the point it opens with', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-08',
      progressions: [item('lead', ['a', 'b']), item('second', ['c'])],
      ...size,
    });
    expect(graph.progressions[0]?.summary).toBe('lead のまとめ');
    expect(graph.progressions[1]?.summary).toBeUndefined();
  });

  it('draws the same month the same way twice', () => {
    const build = () =>
      buildProgressionGraph({
        monthKey: '2026-08',
        progressions: [item('p1', ['a']), item('p2', ['b'])],
        ...size,
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});
