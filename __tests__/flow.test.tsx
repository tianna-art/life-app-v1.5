/**
 * 感情クエスト.
 *
 * The two rules worth testing are both about what is *not* kept: nothing is
 * stored until the end, and a stage left blank stays absent.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlowQuest } from '@components/flow/FlowQuest';

function walkTo(stage: 'rain' | 'river' | 'ocean' | 'cloud') {
  fireEvent.press(screen.getByTestId('flow-begin'));
  const order = ['rain', 'river', 'ocean', 'cloud'] as const;
  for (const id of order) {
    if (id === stage) return;
    fireEvent.press(screen.getByTestId(`flow-next-${id}`));
  }
}

describe('nothing is kept until the end', () => {
  it('offers no way to save part-way through', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);

    walkTo('rain');
    expect(screen.queryByTestId('flow-save')).toBeNull();
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '嫌だったこと');

    fireEvent.press(screen.getByTestId('flow-next-rain'));
    expect(screen.queryByTestId('flow-save')).toBeNull();

    fireEvent.press(screen.getByTestId('flow-next-river'));
    expect(screen.queryByTestId('flow-save')).toBeNull();

    // Only the last stage carries the decision, and it carries both halves.
    fireEvent.press(screen.getByTestId('flow-next-ocean'));
    expect(screen.getByTestId('flow-close')).toBeTruthy();
    expect(screen.getByTestId('flow-save')).toBeTruthy();
    expect(screen.getByTestId('flow-discard')).toBeTruthy();

    expect(onSave).not.toHaveBeenCalled();
  });

  it('lets the whole run be thrown away, having written the hard part', () => {
    const onSave = jest.fn();
    const onDiscard = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={onDiscard} />);

    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), 'いちばん言いにくいこと');
    fireEvent.press(screen.getByTestId('flow-next-rain'));
    fireEvent.press(screen.getByTestId('flow-next-river'));
    fireEvent.press(screen.getByTestId('flow-next-ocean'));
    fireEvent.press(screen.getByTestId('flow-discard'));

    expect(onDiscard).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    // And it is gone, not waiting behind the doorway.
    expect(screen.getByTestId('flow-intro')).toBeTruthy();
    fireEvent.press(screen.getByTestId('flow-begin'));
    expect(screen.getByTestId('flow-input-rain').props.value).toBe('');
  });
});

describe('what a finished run keeps', () => {
  it('keeps the stages that were written and leaves the rest out', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);

    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '降らせたもの');
    fireEvent.press(screen.getByTestId('flow-next-rain'));
    fireEvent.press(screen.getByTestId('flow-next-river'));
    fireEvent.press(screen.getByTestId('flow-next-ocean'));
    fireEvent.changeText(screen.getByTestId('flow-input-cloud'), '持っていくもの');
    fireEvent.press(screen.getByTestId('flow-save'));

    expect(onSave).toHaveBeenCalledWith({ rain: '降らせたもの', cloud: '持っていくもの' });
  });

  it('treats whitespace as blank — a space is not an answer', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '   ');
    fireEvent.press(screen.getByTestId('flow-next-rain'));
    fireEvent.press(screen.getByTestId('flow-next-river'));
    fireEvent.press(screen.getByTestId('flow-next-ocean'));
    fireEvent.press(screen.getByTestId('flow-save'));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it('requires nothing of any stage', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.press(screen.getByTestId('flow-next-rain'));
    fireEvent.press(screen.getByTestId('flow-next-river'));
    fireEvent.press(screen.getByTestId('flow-next-ocean'));
    fireEvent.press(screen.getByTestId('flow-save'));
    expect(onSave).toHaveBeenCalledWith({});
  });
});

describe('the doorway', () => {
  it('shows what was written last time, so it can be read again', () => {
    render(
      <FlowQuest
        last={{ id: 's1', entries: { rain: '前に書いたもの' }, createdAt: '2026-09-01T00:00:00Z' }}
        onSave={jest.fn()}
        onDiscard={jest.fn()}
      />
    );
    expect(screen.getByTestId('flow-last')).toBeTruthy();
    expect(screen.getAllByText('前に書いたもの').length).toBeGreaterThan(0);
  });

  it('shows nothing of the sort on a first run', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    expect(screen.queryByTestId('flow-last')).toBeNull();
  });
});
