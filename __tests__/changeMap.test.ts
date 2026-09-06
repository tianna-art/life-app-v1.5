import { MAX_NODES, buildChangeMap } from '@/map/changeMap';
import type { Change } from '@/types';

const change = (id: string, overrides: Partial<Change> = {}): Change =>
  ({
    id,
    userId: 'u1',
    periodType: 'month',
    year: 2026,
    month: 9,
    title: `${id}の方へ動く`,
    linkedTargetType: 'desired_self',
    linkedTargetLabel: '自分で決められる',
    currentState: '',
    observation: '',
    targetConnection: '',
    confidence: 'supported',
    position: 0,
    userEdited: false,
    evidence: [
      { logId: `${id}-1`, occurredOn: '2026-09-01', role: 'attempt', text: '', logType: 'thought', momentTags: [] },
      { logId: `${id}-2`, occurredOn: '2026-09-08', role: 'current', text: '', logType: 'thought', momentTags: [] },
    ],
    gains: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as Change;

const box = { width: 340, height: 400 };

describe('the sky', () => {
  it('draws one point per change and nothing else (§22, §23)', () => {
    const changes = [change('a'), change('b'), change('c')];
    const graph = buildChangeMap({ monthKey: '2026-09', changes, ...box });
    expect(graph.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(graph.edges).toHaveLength(3);
  });

  it('labels each point with what changed, not what it was about (§19)', () => {
    const graph = buildChangeMap({
      monthKey: '2026-09',
      changes: [change('a', { title: '自分の基準で選ぶ' })],
      ...box,
    });
    expect(graph.nodes[0]?.title).toBe('自分の基準で選ぶ');
  });

  it('draws two points for a month with two changes (§20)', () => {
    // The count is what the month produced. There is no padding to a minimum:
    // a filled sky is only worth having if every point cleared §43.
    const graph = buildChangeMap({
      monthKey: '2026-09',
      changes: [change('a'), change('b')],
      ...box,
    });
    expect(graph.nodes).toHaveLength(2);
  });

  it('draws ME alone when the month produced nothing (§31)', () => {
    const graph = buildChangeMap({ monthKey: '2026-09', changes: [], ...box });
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.me.r).toBeGreaterThan(0);
  });

  it('never draws more than five (§20)', () => {
    const changes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => change(id));
    const graph = buildChangeMap({ monthKey: '2026-09', changes, ...box });
    expect(graph.nodes).toHaveLength(MAX_NODES);
  });

  it('has no level below a point (§21)', () => {
    // Branching that the records do not support is invention. What used to be
    // a branch is the evidence list on the card, where records belong.
    //
    // Every edge leaving ME and none leaving anything else is the property —
    // an edge between two points would be the third level growing back.
    const graph = buildChangeMap({
      monthKey: '2026-09',
      changes: [change('a'), change('b'), change('c')],
      ...box,
    });
    expect(graph.edges).toHaveLength(3);
    for (const edge of graph.edges) {
      expect({ x: edge.fromX, y: edge.fromY }).toEqual({ x: graph.me.x, y: graph.me.y });
    }
  });

  it('settles into the same shape every time a month is opened', () => {
    const changes = [change('a'), change('b'), change('c')];
    const once = buildChangeMap({ monthKey: '2026-09', changes, ...box });
    const twice = buildChangeMap({ monthKey: '2026-09', changes, ...box });
    expect(twice.nodes.map((n) => [n.x, n.y])).toEqual(once.nodes.map((n) => [n.x, n.y]));
  });

  it('keeps every point inside the canvas', () => {
    const changes = ['a', 'b', 'c', 'd', 'e'].map((id) => change(id));
    const graph = buildChangeMap({ monthKey: '2026-09', changes, width: 300, height: 320 });
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(300);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(320);
    }
  });

  it('lights a change more when more stands behind it, and never ranks them', () => {
    const graph = buildChangeMap({
      monthKey: '2026-09',
      changes: [change('a', { confidence: 'signal' }), change('b', { confidence: 'strong' })],
      ...box,
    });
    const [signal, strong] = graph.nodes;
    expect(strong?.glow).toBeGreaterThan(signal?.glow ?? 1);
    // Nothing on a node is a number the eye can read as a score.
    expect(signal).not.toHaveProperty('rank');
    expect(signal).not.toHaveProperty('score');
  });

  it('gives each thing the person put down its own arc (§14)', () => {
    const graph = buildChangeMap({
      monthKey: '2026-09',
      targetLabels: { desired_self: 'ありたい姿', emerging_direction: '宣言の外' },
      changes: [
        change('a'),
        change('b'),
        change('c', {
          linkedTargetType: 'emerging_direction',
          linkedTargetId: undefined,
          linkedTargetLabel: '人と体験をつくる',
        }),
      ],
      ...box,
    });

    expect(graph.sectors.map((s) => s.label)).toEqual(['ありたい姿', '宣言の外']);
    // The arc holding two changes holds both of them, and the other holds one.
    expect(graph.sectors.map((s) => s.changeIds.length)).toEqual([2, 1]);
  });

  it('keeps a sector label on the canvas', () => {
    // At the left and right extremes the label box is wider than the room
    // left for it, and a label half off the screen is worse than a nudged one.
    const graph = buildChangeMap({
      monthKey: '2026-09',
      targetLabels: { desired_self: 'ありたい姿' },
      changes: ['a', 'b', 'c', 'd', 'e'].map((id) => change(id)),
      width: 300,
      height: 320,
    });
    for (const sector of graph.sectors) {
      expect(sector.x).toBeGreaterThan(0);
      expect(sector.x).toBeLessThan(300);
      expect(sector.y).toBeGreaterThan(0);
      expect(sector.y).toBeLessThan(320);
    }
  });

  it('puts a sector label clear of the titles under its own points', () => {
    // A group holding one change puts its label on the same bearing as that
    // change's title. They need room or they print on top of each other.
    const graph = buildChangeMap({
      monthKey: '2026-09',
      targetLabels: { desired_self: 'ありたい姿' },
      changes: [change('a')],
      ...box,
    });
    const node = graph.nodes[0]!;
    const sector = graph.sectors[0]!;
    const fromMe = (x: number, y: number) => Math.hypot(x - graph.me.x, y - graph.me.y);
    // Past the deepest a two-line title can reach under the point.
    expect(fromMe(sector.x, sector.y)).toBeGreaterThan(fromMe(node.x, node.y) + 42);
  });

  it('marks the one the person is looking at (§24)', () => {
    const graph = buildChangeMap({
      monthKey: '2026-09',
      changes: [change('a'), change('b')],
      selectedId: 'b',
      ...box,
    });
    expect(graph.nodes.find((n) => n.id === 'b')?.selected).toBe(true);
    expect(graph.nodes.find((n) => n.id === 'a')?.selected).toBe(false);
  });
});
