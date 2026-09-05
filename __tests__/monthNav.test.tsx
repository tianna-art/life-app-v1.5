import { fireEvent, render } from '@testing-library/react-native';
import { MonthNav } from '../components/home/MonthNav';
import { DirectionPlate } from '../components/home/DirectionPlate';
import type { YearDirection } from '../src/types';

/**
 * The month plate on LOG is something to look through, not somewhere to write.
 * These tests hold the two edges that make that true: forward stops at the
 * present, and the reading is only reachable once a month is over.
 */
describe('MonthNav', () => {
  it('steps backwards freely', () => {
    const onStep = jest.fn();
    const screen = render(
      <MonthNav monthKey="2026-09" canGoForward={false} onStep={onStep} />
    );

    fireEvent.press(screen.getByTestId('month-prev'));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it('does not step past the current month', () => {
    const onStep = jest.fn();
    const screen = render(
      <MonthNav monthKey="2026-09" canGoForward={false} onStep={onStep} />
    );

    fireEvent.press(screen.getByTestId('month-next'));
    expect(onStep).not.toHaveBeenCalled();
  });

  it('steps forward once there is a month ahead to come back to', () => {
    const onStep = jest.fn();
    const screen = render(
      <MonthNav monthKey="2026-07" canGoForward onStep={onStep} />
    );

    fireEvent.press(screen.getByTestId('month-next'));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('only offers the reading when one is being offered', () => {
    const bare = render(<MonthNav monthKey="2026-09" canGoForward={false} onStep={jest.fn()} />);
    expect(bare.queryByTestId('month-open')).toBeNull();

    const onOpen = jest.fn();
    const withReading = render(
      <MonthNav monthKey="2026-07" canGoForward onStep={jest.fn()} onOpen={onOpen} />
    );
    fireEvent.press(withReading.getByTestId('month-open'));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('DirectionPlate', () => {
  const direction: YearDirection = {
    id: 'd1',
    userId: 'u1',
    year: 2026,
    selectedAreas: ['work'],
    desiredSelfCards: ['decide_myself'],
    progressionLenses: ['人に見せる', '自分で決める'],
    initialTheme: '自分の感性を、外の世界へ',
  };

  it('says nothing at all until a direction has been set', () => {
    const screen = render(<DirectionPlate direction={null} onPress={jest.fn()} />);
    expect(screen.queryByTestId('direction-plate')).toBeNull();
  });

  it('shows the theme with what the reading watches for', () => {
    const screen = render(<DirectionPlate direction={direction} onPress={jest.fn()} />);
    expect(screen.getByText('自分の感性を、外の世界へ')).toBeTruthy();
    expect(screen.getByText(/人に見せる/)).toBeTruthy();
  });

  it('shows no distance from any of it (§1)', () => {
    const screen = render(<DirectionPlate direction={direction} onPress={jest.fn()} />);
    // A lens is not a mark: nothing here may read as how far along they are.
    for (const banned of ['%', '達成', '目標', '/', '残り']) {
      expect(screen.queryByText(new RegExp(banned.replace('/', '\\/')))).toBeNull();
    }
  });
});
