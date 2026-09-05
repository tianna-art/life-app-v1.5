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

  it('puts a point the cards made worth watching ahead of a busier one', () => {
    // §19: the lens raises priority. It is what makes the five about what the
    // person said they wanted, rather than about who wrote the most.
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
    // Repeated enjoyment that has nothing to do with the year's words is
    // exactly what must not be filtered away.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('outside', ['a', 'b'], { pattern: 'repeat' })],
      watched: ['expose', 'own_call'],
      ...size,
    });
    expect(graph.progressions.map((n) => n.id)).toEqual(['outside']);
  });

  it('lets the brief choose which five, not only which is first', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`p${i}`, [`l${i}`]));
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: many,
      lead: {
        periodKey: '2026-09',
        leadProgressionId: 'p7',
        leadReason: 'なりたい姿に近い記録が続いています',
        points: ['p7', 'p6', 'p5'],
        generatedAt: '2026-09-30T00:00:00.000Z',
      },
      ...size,
    });
    const shown = graph.progressions.map((n) => n.id);
    expect(shown.slice(0, 3)).toEqual(['p7', 'p6', 'p5']);
  });

  it('lets the brief choose which point opens the month', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-08',
      progressions: [item('busiest', ['a', 'b', 'c']), item('chosen', ['d'])],
      lead: {
        periodKey: '2026-08',
        leadProgressionId: 'chosen',
        leadReason: '自分で決められるようになりたい、という言葉に近い記録が続いています',
        points: ['chosen', 'busiest'],
        generatedAt: '2026-09-01T00:00:00.000Z',
      },
      ...size,
    });
    expect(graph.progressions[0]?.id).toBe('chosen');
  });

  it('will not let a sentence put a point on a map it has no records on', () => {
    // The brief decides the order; the month decides who is there at all.
    const graph = buildProgressionGraph({
      monthKey: '2026-08',
      progressions: [item('here', ['a'])],
      lead: {
        periodKey: '2026-08',
        leadProgressionId: 'not-in-this-month',
        leadReason: 'これが最初です',
        points: ['not-in-this-month'],
        generatedAt: '2026-09-01T00:00:00.000Z',
      },
      ...size,
    });
    expect(graph.progressions.map((n) => n.id)).toEqual(['here']);
  });

  it('leaves the sentence about the month to the month itself', () => {
    // It sits under SEPTEMBER 2026, not under the point it is about: it is a
    // sentence about the month, and on the canvas it competed with the title
    // it sat beneath.
    const graph = buildProgressionGraph({
      monthKey: '2026-09',
      progressions: [item('lead', ['a', 'b'])],
      lead: {
        periodKey: '2026-09',
        leadProgressionId: 'lead',
        leadReason: 'なりたい姿に近い記録が続いています',
        points: ['lead'],
        generatedAt: '2026-09-30T00:00:00.000Z',
      },
      ...size,
    });
    expect(JSON.stringify(graph.progressions)).not.toContain('なりたい姿');
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
