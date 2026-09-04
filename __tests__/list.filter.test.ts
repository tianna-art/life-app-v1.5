/**
 * LIST: すべて / 出来事 / つぶやき filtering, and the one-line truncation rule.
 */
import { truncate, toSingleLine } from '@/utils/text';
import { formatShortDate, monthKeyOfDate, monthsOfYear } from '@/utils/period';
import type { JournalLog } from '@/types';

type Filter = 'all' | 'event' | 'thought';

function applyFilter(logs: JournalLog[], filter: Filter): JournalLog[] {
  return filter === 'all' ? logs : logs.filter((l) => l.type === filter);
}

const logs: JournalLog[] = [
  {
    id: 'a',
    userId: 'u',
    occurredOn: '2026-09-04',
    type: 'event',
    categoryId: 'c1',
    body: '展示を見に行った',
    createdAt: '2026-09-04T10:00:00.000Z',
  },
  {
    id: 'b',
    userId: 'u',
    occurredOn: '2026-09-06',
    type: 'thought',
    categoryId: 'c2',
    body: '新しい企画の方向性が見えてきた気がするが、まだ言葉にはできていない',
    createdAt: '2026-09-06T10:00:00.000Z',
  },
  {
    id: 'c',
    userId: 'u',
    occurredOn: '2026-08-30',
    type: 'event',
    categoryId: 'c1',
    body: '本を読み終えた',
    createdAt: '2026-08-30T10:00:00.000Z',
  },
];

describe('LIST filter', () => {
  it('すべて returns every log', () => {
    expect(applyFilter(logs, 'all')).toHaveLength(3);
  });

  it('出来事 returns only events', () => {
    const result = applyFilter(logs, 'event');
    expect(result.map((l) => l.id)).toEqual(['a', 'c']);
  });

  it('つぶやき returns only thoughts', () => {
    const result = applyFilter(logs, 'thought');
    expect(result.map((l) => l.id)).toEqual(['b']);
  });

  it('groups logs into their own month only', () => {
    const buckets = new Map(monthsOfYear(2026).map((k) => [k, [] as JournalLog[]]));
    for (const log of logs) buckets.get(monthKeyOfDate(log.occurredOn))?.push(log);

    expect(buckets.get('2026-09')?.map((l) => l.id)).toEqual(['a', 'b']);
    expect(buckets.get('2026-08')?.map((l) => l.id)).toEqual(['c']);
    expect(buckets.get('2026-07')).toEqual([]);
    expect([...buckets.keys()]).toHaveLength(12);
  });

  it('renders a row as date + one truncated line', () => {
    const log = logs[1]!;
    expect(formatShortDate(log.occurredOn)).toBe('09/06');
    const preview = truncate(log.body, 12);
    expect(preview).toBe('新しい企画の方向性が見え…');
    expect(preview.endsWith('…')).toBe(true);
  });

  it('does not truncate a short body', () => {
    expect(truncate('本を読み終えた', 22)).toBe('本を読み終えた');
  });

  it('collapses newlines so a row stays one line', () => {
    expect(toSingleLine('一行目\n二行目')).toBe('一行目 二行目');
  });
});
