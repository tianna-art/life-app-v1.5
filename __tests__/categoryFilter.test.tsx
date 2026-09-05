import { fireEvent, render } from '@testing-library/react-native';
import { CategoryFilter } from '../components/list/CategoryFilter';
import { CategoryIcon } from '../components/log/CategoryIcon';
import { LOG_TYPES } from '../src/constants/log';
import { LABELS } from '../src/constants/copy';

/**
 * A way of finding something, not a way of scoring it (§29).
 */
describe('CategoryFilter', () => {
  it('opens on every door', () => {
    const screen = render(<CategoryFilter value={null} onChange={jest.fn()} />);
    expect(screen.getByText(LABELS.allCategories)).toBeTruthy();
    for (const type of LOG_TYPES) expect(screen.getByText(type.label)).toBeTruthy();
  });

  it('picks a door, and lets the same tap put it back', () => {
    const onChange = jest.fn();
    const screen = render(<CategoryFilter value={null} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('filter-thought'));
    expect(onChange).toHaveBeenCalledWith('thought');

    const chosen = render(<CategoryFilter value="thought" onChange={onChange} />);
    fireEvent.press(chosen.getByTestId('filter-thought'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('puts no number beside any door (§29)', () => {
    const screen = render(<CategoryFilter value={null} onChange={jest.fn()} />);
    expect(screen.queryByText(/\d/)).toBeNull();
  });

  it('keeps the order the composer uses', () => {
    // Someone learns the doors by writing. A different order here would cost
    // them a beat every time they came to look something up.
    const screen = render(<CategoryFilter value={null} onChange={jest.fn()} />);
    const order = LOG_TYPES.map((t) => screen.getByText(t.label));
    expect(order).toHaveLength(LOG_TYPES.length);
  });
});

describe('CategoryIcon', () => {
  it('draws a distinct mark for each door', () => {
    const drawn = LOG_TYPES.map((type) =>
      JSON.stringify(render(<CategoryIcon logType={type.id} />).toJSON())
    );
    expect(new Set(drawn).size).toBe(LOG_TYPES.length);
  });

  it('draws all three at the same weight (§9)', () => {
    // None of the doors is the main one, so none of them may look like it.
    const sizes = LOG_TYPES.map((type) => {
      const svg = render(<CategoryIcon logType={type.id} />).toJSON();
      return JSON.stringify(
        (Array.isArray(svg) ? svg[0] : svg)?.props?.width ?? null
      );
    });
    expect(new Set(sizes).size).toBe(1);
  });
});
