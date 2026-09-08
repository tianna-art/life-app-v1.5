import { fireEvent, render } from '@testing-library/react-native';
import { DailyComposer } from '../components/log/DailyComposer';

/** The composer always knows which month and day it is writing into. */
const frame = {
  monthKey: '2026-09',
  defaultDay: '2026-09-05',
  latestDay: '2026-09-05',
  antennaIds: ['progress'] as const,
};

/**
 * Three taps and a line, and the line is optional.
 *
 * The category and the detail are already a record: 「何があった？」 is asked
 * the same way under every category and answering it is not required. That is
 * the whole reason the target is seconds rather than a sitting.
 */
describe('DailyComposer', () => {
  it('saves on a category alone', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer {...frame} onSave={onSave} />);

    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('category-progress_did'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'progress_did', inputMethod: 'category' })
    );
    // Nothing was written, so nothing is sent as though it had been.
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('body');
  });

  it('offers only the month antennas, not all fifteen', () => {
    // The fifteen exist; a month is three or six of them. Putting them all on
    // the screen would turn the first tap from a reflex into a search.
    const screen = render(<DailyComposer {...frame} onSave={jest.fn()} />);
    expect(screen.getByTestId('category-progress_did')).toBeTruthy();
    expect(screen.queryByTestId('category-values_important')).toBeNull();
    expect(screen.queryByTestId('category-self_hard')).toBeNull();
  });

  it('offers both antennas when two were picked', () => {
    const screen = render(
      <DailyComposer {...frame} antennaIds={['progress', 'values']} onSave={jest.fn()} />
    );
    expect(screen.getByTestId('category-progress_did')).toBeTruthy();
    expect(screen.getByTestId('category-values_important')).toBeTruthy();
  });

  it('asks nothing before there is something to ask about', () => {
    // The detail's question belongs to the category, so neither the detail nor
    // the free text exists until one is chosen.
    const screen = render(<DailyComposer {...frame} onSave={jest.fn()} />);
    expect(screen.queryByTestId('detail-picker')).toBeNull();
    expect(screen.queryByTestId('body-input')).toBeNull();

    fireEvent.press(screen.getByTestId('category-progress_did'));
    expect(screen.getByTestId('detail-picker')).toBeTruthy();
    expect(screen.getByTestId('body-input')).toBeTruthy();
  });

  it('asks the question that belongs to the category', () => {
    const screen = render(<DailyComposer {...frame} onSave={jest.fn()} />);
    fireEvent.press(screen.getByTestId('category-progress_did'));
    expect(screen.getByText('どんな「できた」だった？')).toBeTruthy();

    fireEvent.press(screen.getByTestId('category-progress_learned'));
    expect(screen.getByText('何について分かった？')).toBeTruthy();
  });

  it('takes one detail, and lets it be taken back', () => {
    // One, not several: the category already said what kind of day it was, and
    // a record about two things is two records.
    const onSave = jest.fn();
    const screen = render(<DailyComposer {...frame} onSave={onSave} />);

    fireEvent.press(screen.getByTestId('category-progress_did'));
    fireEvent.press(screen.getByTestId('detail-first_time'));
    fireEvent.press(screen.getByTestId('detail-kept_going'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ detailId: 'kept_going' }));

    onSave.mockClear();
    fireEvent.press(screen.getByTestId('category-progress_did'));
    fireEvent.press(screen.getByTestId('detail-first_time'));
    fireEvent.press(screen.getByTestId('detail-first_time'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('detailId');
  });

  it('drops a detail that belonged to another category', () => {
    // Details are not shared: keeping one across a change of category would
    // file the record under an option that category never offered.
    const onSave = jest.fn();
    const screen = render(<DailyComposer {...frame} onSave={onSave} />);

    fireEvent.press(screen.getByTestId('category-progress_did'));
    fireEvent.press(screen.getByTestId('detail-first_time'));
    fireEvent.press(screen.getByTestId('category-progress_learned'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'progress_learned' })
    );
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('detailId');
  });

  it('keeps what was written, and clears everything on reset', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer {...frame} onSave={onSave} />);

    fireEvent.press(screen.getByTestId('category-progress_tried'));
    fireEvent.changeText(screen.getByTestId('body-input'), '  初めて人に見せた  ');
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ body: '初めて人に見せた' })
    );

    // Saving clears it, so the next record does not inherit the last one.
    expect(screen.queryByTestId('body-input')).toBeNull();
  });

  it('files the record on the day that was chosen, not on today', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer {...frame} onSave={onSave} />);
    fireEvent.press(screen.getByTestId('category-progress_did'));
    fireEvent.press(screen.getByTestId('composer-save'));
    // Midday, so it cannot land on the day before in another timezone.
    expect(onSave.mock.calls[0]?.[0].occurredAt).toBe('2026-09-05T12:00:00.000Z');
  });
});
