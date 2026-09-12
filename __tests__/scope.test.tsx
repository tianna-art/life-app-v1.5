/**
 * 月次 / 年次.
 *
 * The rule under test is what an empty period looks like: all three tabs
 * present, each saying plainly that there is nothing there yet, and none of
 * them filled with something that reads like content.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PeriodMap } from '@components/scope/PeriodMap';
import { ScopeTabs } from '@components/scope/ScopeTabs';
import type { MonthInsight } from '@/types';

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
