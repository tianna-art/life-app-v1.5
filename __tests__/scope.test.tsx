/**
 * 月次 / 年次.
 *
 * The rule under test is what an empty period looks like: all three tabs
 * present, each saying plainly that there is nothing there yet, and none of
 * them filled with something that reads like content. The fourth tab — the
 * comparison — is a naming-time tab and is not on offer the rest of the time.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PeriodMap } from '@components/scope/PeriodMap';
import { PeriodChange } from '@components/scope/PeriodChange';
import { ScopeTabs, namingTabs } from '@components/scope/ScopeTabs';
import * as data from '@/data';
import type { JournalLog, MonthInsight, PeriodChange as Change } from '@/types';

function insight(id: string, over: Partial<MonthInsight> = {}): MonthInsight {
  return {
    id,
    periodKey: '2026-09',
    antennaId: 'progress',
    label: '積み上がったこと',
    text: `見立て ${id}`,
    why: '',
    note: '',
    evidenceLogIds: ['l1', 'l2'],
    ...over,
  };
}

describe('the three tabs', () => {
  it('are all offered, whether or not there is anything behind them', () => {
    render(<ScopeTabs value="map" onChange={jest.fn()} />);
    expect(screen.getByTestId('scope-tab-map')).toBeTruthy();
    expect(screen.getByTestId('scope-tab-summary')).toBeTruthy();
    expect(screen.getByTestId('scope-tab-records')).toBeTruthy();
  });

  it('switch', () => {
    const onChange = jest.fn();
    render(<ScopeTabs value="map" onChange={onChange} />);
    fireEvent.press(screen.getByTestId('scope-tab-records'));
    expect(onChange).toHaveBeenCalledWith('records');
  });
});

describe('the period map', () => {
  it('shows what the period was watching at its centre', () => {
    render(
      <PeriodMap month={9} antennaIds={['progress']} insights={[]} onOpen={jest.fn()} />
    );
    expect(screen.getByText('9月の方向')).toBeTruthy();
    expect(screen.getByText('前進を実感する')).toBeTruthy();
  });

  it('draws a point per card, and never more than four', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => insight(id));
    render(<PeriodMap month={9} antennaIds={['progress']} insights={many} onOpen={jest.fn()} />);
    expect(screen.getByTestId('map-point-d')).toBeTruthy();
    expect(screen.queryByTestId('map-point-e')).toBeNull();
  });

  it('opens the records behind a point', () => {
    const onOpen = jest.fn();
    const card = insight('a');
    render(<PeriodMap month={9} antennaIds={['progress']} insights={[card]} onOpen={onOpen} />);
    fireEvent.press(screen.getByTestId('map-point-a'));
    expect(onOpen).toHaveBeenCalledWith(card);
  });

  it('is empty when the period produced nothing, and generates nothing to fill it', () => {
    render(<PeriodMap month={9} antennaIds={['progress']} insights={[]} onOpen={jest.fn()} />);
    expect(screen.queryByTestId('map-point-a')).toBeNull();
    // No hint about tapping points that are not there.
    expect(screen.queryByText('点をタップすると、その話が出てきます。')).toBeNull();
  });

  it('still draws the centre for a period with no direction set', () => {
    render(<PeriodMap month={9} antennaIds={[]} insights={[]} onOpen={jest.fn()} />);
    expect(screen.getByTestId('period-map')).toBeTruthy();
  });
});

describe('the fourth tab', () => {
  it('is absent from the tabs a period offers at any time', () => {
    render(<ScopeTabs value="map" onChange={jest.fn()} />);
    expect(screen.queryByTestId('scope-tab-change')).toBeNull();
  });

  it('appears while a name is being decided, labelled by the period', () => {
    render(
      <ScopeTabs value="summary" onChange={jest.fn()} tabs={namingTabs('month')} />
    );
    expect(screen.getByText('先月からの変化')).toBeTruthy();
    // The map is not repeated here: the same figure under two tabs would read
    // as two different analyses.
    expect(screen.queryByTestId('scope-tab-map')).toBeNull();
  });

  it('says 去年との違い for a year', () => {
    render(<ScopeTabs value="summary" onChange={jest.fn()} tabs={namingTabs('year')} />);
    expect(screen.getByText('去年との違い')).toBeTruthy();
  });
});

function log(id: string, body: string): JournalLog {
  return {
    id,
    userId: 'u1',
    occurredOn: '2026-08-08',
    periodKey: '2026-08',
    categoryId: null,
    detailId: null,
    body,
    inputMethod: 'typed',
    source: 'manual',
    sourceId: null,
    createdAt: '2026-08-08T00:00:00.000Z',
  };
}

function renderChange(
  periodType: 'month' | 'year',
  change: Change | null,
  logs: JournalLog[] = []
) {
  jest.spyOn(data, 'getRepository').mockReturnValue({
    getPeriodChange: async () => change,
    getLogs: async () => logs,
  } as unknown as ReturnType<typeof data.getRepository>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodChange periodType={periodType} periodKey={periodType === 'month' ? '2026-09' : '2026'} />
    </QueryClientProvider>
  );
}

describe('the comparison, before there is one', () => {
  afterEach(() => jest.restoreAllMocks());

  it('says the records are not many yet, and claims no difference', async () => {
    renderChange('month', null);
    await waitFor(() =>
      expect(screen.getByText('先月と比べられる記録は、まだ多くありません。')).toBeTruthy()
    );
  });

  it('uses the year wording for a year', async () => {
    renderChange('year', null);
    await waitFor(() =>
      expect(screen.getByText('比べられる記録は、まだ多くありません。')).toBeTruthy()
    );
  });
});

describe('the comparison, when there is one', () => {
  afterEach(() => jest.restoreAllMocks());

  const change: Change = {
    id: 'ch1',
    periodType: 'month',
    periodKey: '2026-09',
    compareKey: '2026-08',
    kind: 'progression',
    title: '続け方を決めるところへ動いた',
    summary: '先月は続け方を試していました。今月は次に試す形を決めています。',
    previousLogIds: ['p1'],
    currentLogIds: ['c1'],
    note: 'この2つの期間から言える範囲です。',
  };

  it('shows both sides underneath, so the sentence can be disagreed with', async () => {
    renderChange('month', change, [log('p1', '活動を一つに絞った'), log('c1', '半年続けて確かめる')]);
    await waitFor(() => expect(screen.getByText(change.title)).toBeTruthy());
    expect(screen.getByText('先月')).toBeTruthy();
    expect(screen.getByText('今月')).toBeTruthy();
    expect(screen.getByText('活動を一つに絞った')).toBeTruthy();
    expect(screen.getByText('半年続けて確かめる')).toBeTruthy();
  });

  it('prints what the comparison cannot see, in the same size as the rest', async () => {
    renderChange('month', change, [log('p1', 'a'), log('c1', 'b')]);
    await waitFor(() => expect(screen.getByText(change.note)).toBeTruthy());
  });
});
