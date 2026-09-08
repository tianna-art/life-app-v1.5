import { fireEvent, render } from '@testing-library/react-native';
import { AntennaPicker } from '../components/log/AntennaPicker';
import { ANTENNAS, ANTENNA_ORDER, MAX_ANTENNAS } from '../src/domain/antennas';
import type { AntennaId } from '../src/types';

/**
 * The lens is the month's, and it is at most two.
 *
 * A third axis is how a month stops being about anything: everything gets a
 * little attention and nothing accumulates enough evidence to say anything by
 * the end of it. Picking again next month is what makes two enough.
 */
describe('AntennaPicker', () => {
  it('offers all five, with what each is for', () => {
    const screen = render(<AntennaPicker value={[]} onChange={jest.fn()} />);
    for (const id of ANTENNA_ORDER) {
      expect(screen.getByText(ANTENNAS[id].title)).toBeTruthy();
      // When to choose it, and what the month gives back. Neither is a goal.
      expect(screen.getByText(ANTENNAS[id].recommendedWhen)).toBeTruthy();
      expect(screen.getByText(ANTENNAS[id].provides)).toBeTruthy();
    }
  });

  it('takes a second, and refuses a third', () => {
    const onChange = jest.fn();
    const two: AntennaId[] = ['progress', 'values'];
    const screen = render(<AntennaPicker value={two} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('antenna-spark'));
    expect(onChange).not.toHaveBeenCalled();
    expect(two.length).toBe(MAX_ANTENNAS);
  });

  it('lets a choice be taken back', () => {
    const onChange = jest.fn();
    const screen = render(
      <AntennaPicker value={['progress', 'values']} onChange={onChange} />
    );
    fireEvent.press(screen.getByTestId('antenna-progress'));
    expect(onChange).toHaveBeenCalledWith(['values']);
  });

  it('keeps the unchosen ones on screen at the ceiling', () => {
    // A card that vanishes reads as a bug, and one that silently refuses a
    // tap reads as broken. It goes quiet instead.
    const screen = render(
      <AntennaPicker value={['progress', 'values']} onChange={jest.fn()} />
    );
    expect(screen.getByTestId('antenna-spark')).toBeTruthy();
  });

  it('adds to what is already chosen rather than replacing it', () => {
    const onChange = jest.fn();
    const screen = render(<AntennaPicker value={['progress']} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('antenna-values'));
    expect(onChange).toHaveBeenCalledWith(['progress', 'values']);
  });
});
