import { fireEvent, render } from '@testing-library/react-native';
import { MonthAction } from '../components/list/MonthAction';
import { LABELS } from '../src/constants/copy';

const base = {
  pending: 20,
  running: false,
  done: 0,
  onGenerate: jest.fn(),
  onOpen: jest.fn(),
};

/**
 * The one thing there is to do with a month, beside its name.
 */
describe('MonthAction', () => {
  it('offers to read a month nothing has read', () => {
    const onGenerate = jest.fn();
    const screen = render(<MonthAction {...base} state="none" onGenerate={onGenerate} />);
    expect(screen.getByText(LABELS.generateMap)).toBeTruthy();
    fireEvent.press(screen.getByTestId('month-generate-map'));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('says the map is out of date once new records arrive', () => {
    const screen = render(<MonthAction {...base} state="stale" pending={3} />);
    expect(screen.getByText(LABELS.regenerateMap)).toBeTruthy();
    expect(screen.getByText('3件')).toBeTruthy();
  });

  it('opens the map once the month has been read', () => {
    const onOpen = jest.fn();
    const screen = render(<MonthAction {...base} state="ready" pending={0} onOpen={onOpen} />);
    expect(screen.getByText(LABELS.openMap)).toBeTruthy();
    expect(screen.queryByTestId('month-generate-map')).toBeNull();
    fireEvent.press(screen.getByTestId('month-open-map'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows what a run will read before it is agreed to', () => {
    // Every record is a call the person pays for, so the number is on the
    // button rather than discovered afterwards.
    const screen = render(<MonthAction {...base} state="none" pending={45} />);
    expect(screen.getByText('45件')).toBeTruthy();
  });

  it('counts up while it runs, and offers nothing else meanwhile', () => {
    const screen = render(<MonthAction {...base} state="none" running done={7} pending={20} />);
    expect(screen.getByText('7 / 20')).toBeTruthy();
    expect(screen.queryByTestId('month-generate-map')).toBeNull();
    expect(screen.queryByTestId('month-open-map')).toBeNull();
  });
});
