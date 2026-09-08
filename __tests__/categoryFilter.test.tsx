import { fireEvent, render } from '@testing-library/react-native';
import { CategoryFilter } from '../components/list/CategoryFilter';
import { ANTENNAS, ANTENNA_ORDER, ALL_CATEGORIES } from '../src/constants/log';
import { LABELS } from '../src/constants/copy';
import type { ListFilter } from '../components/list/CategoryFilter';

const NONE: ListFilter = { antennaId: null, categoryId: null };

/**
 * A way of finding something, not a way of scoring it (§29).
 */
describe('CategoryFilter', () => {
  it('offers every antenna and every category, and opens on everything', () => {
    const screen = render(<CategoryFilter value={NONE} onChange={jest.fn()} />);
    expect(screen.getByText(LABELS.allCategories)).toBeTruthy();
    expect(screen.getByText(LABELS.allMoments)).toBeTruthy();
    for (const id of ANTENNA_ORDER) {
      expect(screen.getByText(ANTENNAS[id].shortLabel)).toBeTruthy();
    }
    // Unfiltered, the archive can be searched by any of the fifteen: it holds
    // records from months whose antennas were not this month's.
    for (const category of ALL_CATEGORIES) {
      expect(screen.getAllByText(category.label).length).toBeGreaterThan(0);
    }
  });

  it('picks an antenna, and the same tap puts it back', () => {
    const onChange = jest.fn();
    const screen = render(<CategoryFilter value={NONE} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('filter-progress'));
    expect(onChange).toHaveBeenCalledWith({ antennaId: 'progress', categoryId: null });

    const chosen = render(
      <CategoryFilter value={{ antennaId: 'progress', categoryId: null }} onChange={onChange} />
    );
    fireEvent.press(chosen.getByTestId('filter-progress'));
    expect(onChange).toHaveBeenLastCalledWith({ antennaId: null, categoryId: null });
  });

  it('narrows the second row to the antenna chosen in the first', () => {
    // A category only means something under the question it belongs to, so
    // offering all fifteen under one antenna would let a tap silently widen
    // the row above it.
    const screen = render(
      <CategoryFilter value={{ antennaId: 'progress', categoryId: null }} onChange={jest.fn()} />
    );
    expect(screen.getByTestId('category-filter-progress_did')).toBeTruthy();
    expect(screen.queryByTestId('category-filter-values_important')).toBeNull();
  });

  it('picks a category without losing the antenna', () => {
    const onChange = jest.fn();
    const screen = render(
      <CategoryFilter value={{ antennaId: 'progress', categoryId: null }} onChange={onChange} />
    );
    fireEvent.press(screen.getByTestId('category-filter-progress_did'));
    expect(onChange).toHaveBeenCalledWith({ antennaId: 'progress', categoryId: 'progress_did' });
  });

  it('drops the category when the antenna changes', () => {
    const onChange = jest.fn();
    const screen = render(
      <CategoryFilter
        value={{ antennaId: 'progress', categoryId: 'progress_did' }}
        onChange={onChange}
      />
    );
    fireEvent.press(screen.getByTestId('filter-values'));
    expect(onChange).toHaveBeenCalledWith({ antennaId: 'values', categoryId: null });
  });

  it('puts no number beside any option (§29)', () => {
    const screen = render(<CategoryFilter value={NONE} onChange={jest.fn()} />);
    expect(screen.queryByText(/\d/)).toBeNull();
  });
});
