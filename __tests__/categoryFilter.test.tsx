import { fireEvent, render } from '@testing-library/react-native';
import { CategoryFilter } from '../components/list/CategoryFilter';
import { LOG_TYPES, MOMENT_TAGS } from '../src/constants/log';
import { LABELS } from '../src/constants/copy';
import type { ListFilter } from '../components/list/CategoryFilter';

const NONE: ListFilter = { logType: null, momentTag: null };

/**
 * A way of finding something, not a way of scoring it (§29).
 */
describe('CategoryFilter', () => {
  it('offers both doors and moments, and opens on everything', () => {
    const screen = render(<CategoryFilter value={NONE} onChange={jest.fn()} />);
    expect(screen.getByText(LABELS.allCategories)).toBeTruthy();
    expect(screen.getByText(LABELS.allMoments)).toBeTruthy();
    for (const type of LOG_TYPES) expect(screen.getByText(type.label)).toBeTruthy();
    for (const tag of MOMENT_TAGS) expect(screen.getByText(tag.label)).toBeTruthy();
  });

  it('picks a door, and the same tap puts it back', () => {
    const onChange = jest.fn();
    const screen = render(<CategoryFilter value={NONE} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('filter-thought'));
    expect(onChange).toHaveBeenCalledWith({ logType: 'thought', momentTag: null });

    const chosen = render(
      <CategoryFilter value={{ logType: 'thought', momentTag: null }} onChange={onChange} />
    );
    fireEvent.press(chosen.getByTestId('filter-thought'));
    expect(onChange).toHaveBeenLastCalledWith({ logType: null, momentTag: null });
  });

  it('picks a moment without losing the door', () => {
    const onChange = jest.fn();
    const screen = render(
      <CategoryFilter value={{ logType: 'thought', momentTag: null }} onChange={onChange} />
    );
    fireEvent.press(screen.getByTestId('moment-filter-friction'));
    expect(onChange).toHaveBeenCalledWith({ logType: 'thought', momentTag: 'friction' });
  });

  it('puts no number beside any option (§29)', () => {
    const screen = render(<CategoryFilter value={NONE} onChange={jest.fn()} />);
    expect(screen.queryByText(/\d/)).toBeNull();
  });
});
