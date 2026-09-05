import { buildProgressionGraph } from '../src/map/progressionGraph';
import type { MonthProgression, Progression, ProgressionStep } from '../src/types';

function progression(over: Partial<Progression> = {}): Progression {
  return {
    id: 'p1',
    userId: 'u',
    type: 'capability',
    title: '人に伝える',
    summary: '',
    maturity: 'signal',
    confidence: 0.4,
    firstDetectedAt: '2026-05-01T00:00:00Z',
    lastUpdatedAt: '2026-05-20T00:00:00Z',
    userEdited: false,
    evidenceCount: 2,
    ...over,
  };
}

function monthItem(over: Partial<MonthProgression> = {}): MonthProgression {
  return {
    progression: progression(),
    evidenceLogIds: ['a', 'b'],
    isNew: false,
    maturityThen: 'signal',
    ...over,
  };
}

const BOX = { width: 360, height: 480 };

describe('the map', () => {
  it('shows ME alone when nothing has connected yet (§31)', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-05',
      progressions: [],
      ...BOX,
    });
    expect(graph.progressions).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.me).toMatchObject({ x: 180, y: 240 });
  });

  it('labels level 1 with the person’s words, never the type (§17)', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-05',
      progressions: [
        monthItem({ progression: progression({ id: 'a', type: 'capability', title: '人に伝える' }) }),
        monthItem({ progression: progression({ id: 'b', type: 'direction', title: '働き方' }) }),
      ],
      ...BOX,
    });
    expect(graph.progressions.map((n) => n.title)).toEqual(['人に伝える', '働き方']);
    for (const node of graph.progressions) {
      expect(node.title).not.toMatch(/CAPABILITY|DIRECTION|capability|direction/);
    }
  });

  it('settles the same month into the same sky every time', () => {
    const input = { monthKey: '2026-05', progressions: [monthItem()], ...BOX };
    const first = buildProgressionGraph(input);
    const second = buildProgressionGraph(input);
    expect(second.progressions[0]?.x).toBe(first.progressions[0]?.x);
    expect(second.progressions[0]?.y).toBe(first.progressions[0]?.y);
  });

  it('gives a different month a different sky', () => {
    const may = buildProgressionGraph({ monthKey: '2026-05', progressions: [monthItem()], ...BOX });
    const june = buildProgressionGraph({ monthKey: '2026-06', progressions: [monthItem()], ...BOX });
    expect(june.progressions[0]?.x).not.toBe(may.progressions[0]?.x);
  });

  it('does not arrange nodes on an even ring (§20)', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      monthItem({ progression: progression({ id: `p${i}`, title: `t${i}` }) })
    );
    const graph = buildProgressionGraph({ monthKey: '2026-05', progressions: items, ...BOX });
    const distances = graph.progressions.map((n) =>
      Math.hypot(n.x - graph.me.x, n.y - graph.me.y)
    );
    const spread = Math.max(...distances) - Math.min(...distances);
    expect(spread).toBeGreaterThan(1);
  });

  it('keeps every node inside the canvas', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      monthItem({ progression: progression({ id: `p${i}`, title: `t${i}` }) })
    );
    const graph = buildProgressionGraph({ monthKey: '2026-09', progressions: items, ...BOX });
    for (const node of graph.progressions) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(BOX.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(BOX.height);
    }
  });

  it('draws no steps until a node is opened (§18 level 2)', () => {
    const steps: ProgressionStep[] = [
      {
        logId: 'a',
        occurredOn: '2026-04-01',
        role: 'origin',
        eventSummary: '怖い',
        entryType: 'thought',
        subjectiveSignal: 'negative',
      },
      {
        logId: 'b',
        occurredOn: '2026-05-01',
        role: 'attempt',
        eventSummary: '友達に見せた',
        entryType: 'event',
        subjectiveSignal: 'positive',
      },
    ];

    const closed = buildProgressionGraph({
      monthKey: '2026-05',
      progressions: [monthItem()],
      expandedSteps: steps,
      ...BOX,
    });
    expect(closed.steps).toEqual([]);

    const open = buildProgressionGraph({
      monthKey: '2026-05',
      progressions: [monthItem()],
      expandedId: 'p1',
      expandedSteps: steps,
      ...BOX,
    });
    expect(open.steps).toHaveLength(2);
    // In time order, as the path reads.
    expect(open.steps.map((s) => s.logId)).toEqual(['a', 'b']);
  });

  it('lights a settled progression more than a new one, without ranking them', () => {
    const graph = buildProgressionGraph({
      monthKey: '2026-05',
      progressions: [
        monthItem({ progression: progression({ id: 'a' }), maturityThen: 'signal' }),
        monthItem({ progression: progression({ id: 'b' }), maturityThen: 'established' }),
      ],
      ...BOX,
    });
    const [first, second] = graph.progressions;
    expect(second?.glow).toBeGreaterThan(first?.glow ?? 1);
    // No number reaches the screen: glow is opacity, not a score.
    expect(second?.glow).toBeLessThanOrEqual(1);
  });
});
