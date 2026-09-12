/**
 * 方向を置く.
 *
 * The rule under test is the one that was broken: the row a person most wants
 * to press — the one saying a direction has not been set — is the button. Only
 * the card's small header responded, and the invitation itself was flat text.
 *
 * The marks are tested alongside it, because they are how the two states are
 * told apart: 「›」 when there is something to go and look at, a pencil when
 * there is something to write.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DirectionPlates } from '@components/map/DirectionPlates';

function plates(over: { yearDirection?: string | null; antennaIds?: string[] } = {}) {
  const onEditYear = jest.fn();
  const onEditMonth = jest.fn();
  render(
    <DirectionPlates
      year={2026}
      month={9}
      yearDirection={over.yearDirection ?? null}
      antennaIds={(over.antennaIds ?? []) as never}
      onEditYear={onEditYear}
      onEditMonth={onEditMonth}
    />
  );
  return { onEditYear, onEditMonth };
}

describe('a direction that has not been set', () => {
  it('is a row you can press, for the year', () => {
    const { onEditYear } = plates();
    fireEvent.press(screen.getByTestId('year-direction-place'));
    expect(onEditYear).toHaveBeenCalled();
  });

  it('is a row you can press, for the month', () => {
    const { onEditMonth } = plates();
    fireEvent.press(screen.getByTestId('month-direction-place'));
    expect(onEditMonth).toHaveBeenCalled();
  });

  it('carries no 「›」 — there is nothing yet to go and look at', () => {
    plates();
    expect(screen.queryByText('›')).toBeNull();
  });
});

describe('a direction that has been set', () => {
  it('shows the words, and the header is the way back in', () => {
    const { onEditYear } = plates({ yearDirection: '続け方を決める年' });
    expect(screen.getByText('続け方を決める年')).toBeTruthy();
    // The value is not a second button: the header carries the way in.
    expect(screen.queryByTestId('year-direction-place')).toBeNull();
    fireEvent.press(screen.getByTestId('year-direction'));
    expect(onEditYear).toHaveBeenCalled();
  });

  it('carries the 「›」 once there is something behind it', () => {
    plates({ yearDirection: '続け方を決める年', antennaIds: ['progress'] });
    expect(screen.getAllByText('›').length).toBe(2);
  });
});
