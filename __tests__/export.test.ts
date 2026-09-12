/**
 * 記録の書き出し.
 *
 * The rules under test are about whose words come out. The person's own
 * summary wins over the reading's, both are labelled, and a month that was
 * empty comes out saying so rather than not coming out at all — a file with
 * gaps where the quiet months were is a file that argues.
 */
import { exportFilename, toMarkdown, type ExportInput } from '@/export/markdown';
import type { JournalLog, PeriodSummary } from '@/types';

function log(over: Partial<JournalLog> = {}): JournalLog {
  return {
    id: 'l1',
    userId: 'u1',
    occurredOn: '2026-09-08',
    periodKey: '2026-09',
    categoryId: null,
    detailId: null,
    body: '異動の話が具体的になった',
    inputMethod: 'typed',
    source: 'manual',
    sourceId: null,
    createdAt: '2026-09-08T00:00:00.000Z',
    ...over,
  };
}

function summary(over: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    periodType: 'month',
    periodKey: '2026-09',
    keywords: ['整理', '裁量', '継続'],
    body: 'アプリが書いた文。',
    bodyUser: null,
    updatedAt: '2026-09-30T00:00:00.000Z',
    ...over,
  };
}

function input(over: Partial<ExportInput> = {}): ExportInput {
  return {
    generatedOn: new Date(2026, 8, 12),
    logs: [log()],
    yearDirections: [],
    monthDirections: [],
    monthTitles: [],
    yearTitles: [],
    summaries: [],
    ...over,
  };
}

describe('the file', () => {
  it('is named by the day it was made', () => {
    expect(exportFilename(new Date(2026, 8, 3))).toBe('crincran-2026-09-03.md');
  });

  it('carries the records under the month they belong to', () => {
    const text = toMarkdown(input());
    expect(text).toContain('## 2026年');
    expect(text).toContain('### 9月');
    expect(text).toContain('- 9/8 異動の話が具体的になった');
  });

  it('shows a record with no day by its month, and invents nothing', () => {
    const text = toMarkdown(input({ logs: [log({ occurredOn: null, body: 'いつかの話' })] }));
    expect(text).toContain('- 9月 いつかの話');
  });

  it('says a month was empty rather than leaving it out', () => {
    const text = toMarkdown(
      input({
        logs: [],
        monthTitles: [{ periodType: 'month', periodKey: '2026-09', title: '整えた月', source: 'manual', updatedAt: '2026-09-30T00:00:00.000Z' }],
      })
    );
    expect(text).toContain('### 9月');
    expect(text).toContain('記録はありません。');
  });
});

describe('whose words these are', () => {
  it('prefers what the person wrote, and says it is theirs', () => {
    const text = toMarkdown(
      input({ summaries: [summary({ bodyUser: '自分で書き直した文。' })] })
    );
    expect(text).toContain('要約（自分の言葉）:');
    expect(text).toContain('自分で書き直した文。');
    // The reading's version does not ride along underneath it.
    expect(text).not.toContain('アプリが書いた文。');
  });

  it('marks the reading as the reading when the person wrote nothing', () => {
    const text = toMarkdown(input({ summaries: [summary()] }));
    expect(text).toContain('要約（アプリが書いたもの）:');
  });

  it('leaves the readings out entirely', () => {
    // 見えてきたこと and the comparison are the app's, they can be made again,
    // and mixed into this file they would be indistinguishable later from
    // sentences the person wrote.
    const text = toMarkdown(input());
    expect(text).not.toContain('見えてきたこと');
    expect(text).not.toContain('先月からの変化');
  });
});
