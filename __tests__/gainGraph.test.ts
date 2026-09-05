import { buildGainGraph } from '../src/map/gainGraph';
import type { MonthGain } from '../src/data/repository';
import type { Gain, GainType } from '../src/types';

const gain = (id: string, type: GainType, over: Partial<Gain> = {}): Gain => ({
  id,
  userId: 'u1',
  type,
  label: `${type}-${id}`,
  maturity: 'emerging',
  confidence: 0.5,
  firstDetectedAt: '2026-09-02T00:00:00.000Z',
  lastDetectedAt: '2026-09-20T00:00:00.000Z',
  ...over,
});

const monthGain = (g: Gain, evidence: string[], isNew = true): MonthGain => ({
  gain: g,
  evidenceLogIds: evidence,
  isNew,
});

const SIZE = { width: 360, height: 560 };

describe('the map is drawn around the person', () => {
  it('puts ME at the centre and nothing else there', () => {
    const graph = buildGainGraph({
      monthKey: '2026-09',
      gains: [monthGain(gain('a', 'capability'), ['l1'])],
      ...SIZE,
    });
    expect(graph.me.x).toBe(SIZE.width / 2);
    expect(graph.me.y).toBe(SIZE.height / 2);
    for (const node of graph.gains) {
      expect(Math.hypot(node.x - graph.me.x, node.y - graph.me.y)).toBeGreaterThan(graph.me.r);
    }
  });

  it('shows only the gain types the person actually has', () => {
    const graph = buildGainGraph({
      monthKey: '2026-09',
      gains: [
        monthGain(gain('a', 'capability'), ['l1']),
        monthGain(gain('b', 'evidence'), ['l2']),
      ],
      ...SIZE,
    });
    expect(graph.branches.map((b) => b.type).sort()).toEqual(['capability', 'evidence']);
  });

  it('keeps the records behind a gain hidden until it is opened', () => {
    const gains = [monthGain(gain('a', 'strategy'), ['l1', 'l2', 'l3'])];
    expect(buildGainGraph({ monthKey: '2026-09', gains, ...SIZE }).evidence).toHaveLength(0);
    expect(
      buildGainGraph({ monthKey: '2026-09', gains, expandedGainId: 'a', ...SIZE }).evidence
    ).toHaveLength(3);
  });

  it('settles the same month into the same sky every time', () => {
    const gains = [
      monthGain(gain('a', 'capability'), ['l1']),
      monthGain(gain('b', 'direction'), ['l2']),
      monthGain(gain('c', 'insight'), ['l3']),
    ];
    const first = buildGainGraph({ monthKey: '2026-09', gains, ...SIZE });
    const second = buildGainGraph({ monthKey: '2026-09', gains, ...SIZE });
    expect(second.gains.map((g) => [g.id, g.x, g.y])).toEqual(
      first.gains.map((g) => [g.id, g.x, g.y])
    );
  });

  it('gives a different month a different sky', () => {
    const gains = [
      monthGain(gain('a', 'capability'), ['l1']),
      monthGain(gain('b', 'direction'), ['l2']),
    ];
    const september = buildGainGraph({ monthKey: '2026-09', gains, ...SIZE });
    const august = buildGainGraph({ monthKey: '2026-08', gains, ...SIZE });
    expect(august.gains.map((g) => g.x)).not.toEqual(september.gains.map((g) => g.x));
  });

  it('draws a settled gain larger than a first sighting', () => {
    const graph = buildGainGraph({
      monthKey: '2026-09',
      gains: [
        monthGain(gain('a', 'capability', { maturity: 'signal' }), ['l1']),
        monthGain(gain('b', 'capability', { maturity: 'established' }), ['l2']),
      ],
      ...SIZE,
    });
    const signal = graph.gains.find((g) => g.id === 'a');
    const established = graph.gains.find((g) => g.id === 'b');
    expect(established?.r).toBeGreaterThan(signal?.r ?? 0);
    expect(established?.glow).toBeGreaterThan(signal?.glow ?? 0);
  });

  it('keeps every node inside the canvas', () => {
    const gains = Array.from({ length: 14 }, (_, i) =>
      monthGain(gain(`g${i}`, (['capability', 'insight', 'strategy', 'direction', 'connection', 'evidence'] as const)[i % 6] as GainType), [`l${i}`])
    );
    const graph = buildGainGraph({ monthKey: '2026-09', gains, expandedGainId: 'g0', ...SIZE });
    for (const node of [...graph.gains, ...graph.evidence]) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(SIZE.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(SIZE.height);
    }
  });

  it('draws nothing at all before the first gain exists', () => {
    const graph = buildGainGraph({ monthKey: '2026-09', gains: [], ...SIZE });
    expect(graph.gains).toHaveLength(0);
    expect(graph.branches).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
