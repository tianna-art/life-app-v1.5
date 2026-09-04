/**
 * The hard rule from §17: an AI failure must never cost the user their text.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { setRepository } from '@/data';
import { LocalRepository } from '@/data/localRepository';
import { useCreateLog } from '@/hooks/useLogs';
import { clearQueue, readQueue } from '@/offline/queue';
import { parseCategoryInsight, parseLogAnalysis, parseTitleCandidates } from '@/ai/types';
import { monthKeyOf } from '@/utils/period';

jest.mock('@/ai/client', () => ({
  __esModule: true,
  // The Edge Function is unreachable / returns garbage.
  analyzeLog: jest.fn(async () => {
    throw new Error('LLM provider exploded');
  }),
  analyzeLogText: jest.fn(async () => {
    throw new Error('LLM provider exploded');
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe('AI failure handling', () => {
  let repository: LocalRepository;

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearQueue();
    repository = new LocalRepository();
    await repository.ensureBootstrapped();
    setRepository(repository);
  });

  afterAll(() => setRepository(null));

  it('keeps the log when analysis throws', async () => {
    const categories = await repository.listCategories();
    const categoryId = categories[0]!.id;

    const { result } = renderHook(() => useCreateLog(), { wrapper });

    result.current.mutate({
      type: 'thought',
      categoryId,
      body: 'AIが落ちても、この文章は残らなければならない',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The mutation reports the failure…
    expect(result.current.data?.analysisFailed).toBe(true);
    expect(result.current.data?.queued).toBe(false);

    // …and the log is still there, unanalysed but intact.
    const stored = await repository.listLogsByMonth(monthKeyOf(new Date()));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.body).toBe('AIが落ちても、この文章は残らなければならない');
    expect(stored[0]?.analysis).toBeUndefined();
    expect(await readQueue()).toHaveLength(0);
  });
});

describe('malformed model output is rejected, not stored', () => {
  it('rejects log analysis that is not the agreed shape', () => {
    expect(parseLogAnalysis(null)).toBeNull();
    expect(parseLogAnalysis({})).toBeNull();
    expect(parseLogAnalysis({ keywords: 'not an array' })).toBeNull();
    expect(parseLogAnalysis({ keywords: ['裁量'], semantic_tags: ['Creative Work'] })).toEqual({
      keywords: ['裁量'],
      semanticTags: ['creative_work'],
    });
  });

  it('clamps confidence into 0..1 and caps keywords at five', () => {
    const parsed = parseLogAnalysis({
      keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      semantic_tags: ['t'],
      confidence: 4.2,
    });
    expect(parsed?.keywords).toHaveLength(5);
    expect(parsed?.confidence).toBe(1);
  });

  it('caps insight keywords at three and requires a label', () => {
    const parsed = parseCategoryInsight({
      insight: 'この期間の記録には、試作の場面が何度か現れています。',
      keywords: [
        { label: '試作', confidence: 0.9, evidence_log_ids: ['l1'] },
        { label: '人に見せる', confidence: 0.8, evidence_log_ids: [] },
        { label: '小さく進める', confidence: 0.7, evidence_log_ids: [] },
        { label: '四つ目', confidence: 0.6, evidence_log_ids: [] },
        { confidence: 0.5 },
      ],
    });
    expect(parsed?.keywords).toHaveLength(3);
    expect(parsed?.keywords.map((k) => k.label)).toEqual(['試作', '人に見せる', '小さく進める']);
  });

  it('rejects an insight with no text', () => {
    expect(parseCategoryInsight({ insight: '   ', keywords: [] })).toBeNull();
  });

  it('accepts exactly three title candidates', () => {
    const parsed = parseTitleCandidates({
      candidates: [
        { title: 'SOMETHING STARTED MOVING.', reason: 'r1' },
        { title: 'まだ答えはないけれど、動き始めた月', reason: 'r2' },
        { title: '遠回りの中で見つけたもの', reason: 'r3' },
        { title: '四案目', reason: 'r4' },
      ],
    });
    expect(parsed?.candidates).toHaveLength(3);
    expect(parseTitleCandidates({ candidates: [] })).toBeNull();
  });
});
