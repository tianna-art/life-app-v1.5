/**
 * 足跡タイトルの候補.
 *
 * A reading may suggest what a period was called. It may not name it — so the
 * candidates are never stored, and a run that produces nothing usable is an
 * answer rather than a failure.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useProposeTitles } from '@/hooks/useReading';
import * as client from '@/ai/client';
import { TITLE_COUNT, checkTitles } from '@/ai/reading';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('asking for candidates', () => {
  afterEach(() => jest.restoreAllMocks());

  it('hands back the three the reader proposed', async () => {
    const titles = ['問いが変わった月', '速さを落として進んだ月', '手元に残ったものが分かった月'];
    jest.spyOn(client, 'proposeTitles').mockResolvedValue({ titles });
    const { result } = renderHook(() => useProposeTitles(), { wrapper });
    result.current.mutate({ periodType: 'month', periodKey: '2026-08' });
    await waitFor(() => expect(result.current.data).toEqual(titles));
    expect(titles).toHaveLength(TITLE_COUNT);
    expect(checkTitles(titles).ok).toBe(true);
  });

  it('treats "nothing usable" as an answer, not an error', async () => {
    // The gate rejects a candidate that grades the month, and the function
    // returns an empty list rather than the rejected names.
    jest.spyOn(client, 'proposeTitles').mockResolvedValue({ titles: [], problems: ['judges'] });
    const { result } = renderHook(() => useProposeTitles(), { wrapper });
    result.current.mutate({ periodType: 'month', periodKey: '2026-08' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('says nothing rather than throwing when there is no reader to ask', async () => {
    // Local-store mode has no Edge Function behind it.
    jest.spyOn(client, 'proposeTitles').mockResolvedValue(null);
    const { result } = renderHook(() => useProposeTitles(), { wrapper });
    result.current.mutate({ periodType: 'year', periodKey: '2026' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
