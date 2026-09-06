import { fireEvent, render } from '@testing-library/react-native';
import { MonthAction } from '../components/list/MonthAction';
import { LABELS } from '../src/constants/copy';

const base = {
  pending: 20,
  running: false,
  done: 0,
  onGenerate: jest.fn(),
  onOpen: jest.fn(),
  onReread: jest.fn(),
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

  it('still offers to read a month again once every record is read', () => {
    // Reading the records and reading the month are different jobs. The
    // second can fail on its own and its rules change, and there used to be
    // no way to ask for it again short of forgetting the records and paying
    // for all of them a second time.
    const onReread = jest.fn();
    const screen = render(
      <MonthAction {...base} state="ready" pending={0} onReread={onReread} />
    );
    fireEvent.press(screen.getByTestId('month-reread'));
    expect(onReread).toHaveBeenCalled();
  });

  it('leads with the re-read when the month published nothing', () => {
    // Every record read and no changes: the map is an empty sky. Sending
    // someone to look at it is worse than offering the one thing that might
    // change what is there.
    const onReread = jest.fn();
    const screen = render(
      <MonthAction {...base} state="empty" pending={0} onReread={onReread} />
    );
    expect(screen.getByText(LABELS.readAgain)).toBeTruthy();
    expect(screen.queryByTestId('month-open-map')).toBeNull();
    fireEvent.press(screen.getByTestId('month-reread'));
    expect(onReread).toHaveBeenCalled();
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
    expect(screen.queryByTestId('month-reread')).toBeNull();
  });
});
