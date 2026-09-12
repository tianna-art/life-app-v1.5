/**
 * 感情クエスト.
 *
 * Three rules worth testing, all about what is *not* done: nothing is stored
 * until the end, the decision is made on the 見返し where the words can be
 * read back rather than from inside the last stage, and a stage left blank
 * stays absent.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlowQuest } from '@components/flow/FlowQuest';

/** 完了する, then the way on — the order the screen now insists on. */
function leave(id: 'rain' | 'river' | 'ocean' | 'cloud') {
  fireEvent.press(screen.getByTestId(`flow-done-${id}`));
  fireEvent.press(screen.getByTestId(`flow-next-${id}`));
}

function walkTo(stage: 'rain' | 'river' | 'ocean' | 'cloud') {
  fireEvent.press(screen.getByTestId('flow-begin'));
  const order = ['rain', 'river', 'ocean', 'cloud'] as const;
  for (const id of order) {
    if (id === stage) return;
    leave(id);
  }
}

/** All four stages, and on to the 見返し. */
function walkToReview() {
  walkTo('rain');
  for (const id of ['rain', 'river', 'ocean', 'cloud'] as const) leave(id);
}

describe('nothing is kept until the end', () => {
  it('offers no way to save part-way through', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);

    walkTo('rain');
    expect(screen.queryByTestId('flow-save')).toBeNull();
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '嫌だったこと');

    leave('rain');
    expect(screen.queryByTestId('flow-save')).toBeNull();

    leave('river');
    expect(screen.queryByTestId('flow-save')).toBeNull();

    // Not even on 雲: the last stage moves on like the others.
    leave('ocean');
    expect(screen.queryByTestId('flow-save')).toBeNull();
    fireEvent.press(screen.getByTestId('flow-done-cloud'));
    expect(screen.getByTestId('flow-next-cloud')).toBeTruthy();

    // The 見返し is where it is decided, and it carries both halves.
    fireEvent.press(screen.getByTestId('flow-next-cloud'));
    expect(screen.getByTestId('flow-review')).toBeTruthy();
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
    for (const id of ['rain', 'river', 'ocean', 'cloud'] as const) leave(id);

    // Asked first, because this is the one step that cannot be walked back.
    fireEvent.press(screen.getByTestId('flow-discard'));
    expect(screen.getByTestId('flow-drop-ask')).toBeTruthy();
    expect(onDiscard).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('flow-drop-yes'));
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
    leave('rain');
    leave('river');
    leave('ocean');
    fireEvent.changeText(screen.getByTestId('flow-input-cloud'), '持っていくもの');
    leave('cloud');

    // Both are read back before anything is decided about them.
    expect(screen.getByTestId('flow-review-rain')).toBeTruthy();
    expect(screen.getByTestId('flow-review-cloud')).toBeTruthy();
    expect(screen.queryByTestId('flow-review-river')).toBeNull();

    fireEvent.press(screen.getByTestId('flow-save'));

    expect(onSave).toHaveBeenCalledWith({ rain: '降らせたもの', cloud: '持っていくもの' });
  });

  it('treats whitespace as blank — a space is not an answer', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '   ');
    for (const id of ['rain', 'river', 'ocean', 'cloud'] as const) leave(id);
    expect(screen.queryByTestId('flow-review-rain')).toBeNull();
    fireEvent.press(screen.getByTestId('flow-save'));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it('requires nothing of any stage', () => {
    const onSave = jest.fn();
    render(<FlowQuest last={null} onSave={onSave} onDiscard={jest.fn()} />);
    walkToReview();
    fireEvent.press(screen.getByTestId('flow-save'));
    expect(onSave).toHaveBeenCalledWith({});
  });
});

describe('完了する', () => {
  it('is what opens the way on — writing alone does not', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');

    // Finishing writing and moving downstream are two different decisions.
    expect(screen.queryByTestId('flow-next-rain')).toBeNull();
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '降らせたもの');
    expect(screen.queryByTestId('flow-next-rain')).toBeNull();

    fireEvent.press(screen.getByTestId('flow-done-rain'));
    expect(screen.getByTestId('flow-next-rain')).toBeTruthy();
  });

  it('asks nothing of the stage: a blank one can be closed too', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.press(screen.getByTestId('flow-done-rain'));
    expect(screen.getByTestId('flow-next-rain')).toBeTruthy();
  });

  it('can be taken back, and the way on closes again with it', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '書いたもの');
    fireEvent.press(screen.getByTestId('flow-done-rain'));
    expect(screen.getByTestId('flow-input-rain').props.editable).toBe(false);

    fireEvent.press(screen.getByTestId('flow-edit-rain'));
    expect(screen.queryByTestId('flow-next-rain')).toBeNull();
    expect(screen.getByTestId('flow-input-rain').props.editable).toBe(true);
    expect(screen.getByTestId('flow-input-rain').props.value).toBe('書いたもの');
  });

  it('stays closed when a stage is walked back into', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '降らせたもの');
    leave('rain');
    fireEvent.press(screen.getByTestId('flow-back-river'));
    expect(screen.getByTestId('flow-rain')).toBeTruthy();
    expect(screen.getByTestId('flow-next-rain')).toBeTruthy();
    expect(screen.getByTestId('flow-input-rain').props.value).toBe('降らせたもの');
  });

  it('gives the first stage nowhere to go back to', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');
    expect(screen.queryByTestId('flow-back-rain')).toBeNull();
  });
});

describe('the 見返し', () => {
  it('adds nothing to what was written', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '降らせたもの');
    for (const id of ['rain', 'river', 'ocean', 'cloud'] as const) leave(id);
    // No summary, no reading, no encouragement — the words and nothing else.
    expect(screen.getByText('降らせたもの')).toBeTruthy();
    expect(screen.queryByTestId('flow-input-rain')).toBeNull();
  });

  it('can be walked back out of, with everything still there', () => {
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={jest.fn()} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '書いたもの');
    for (const id of ['rain', 'river', 'ocean', 'cloud'] as const) leave(id);
    fireEvent.press(screen.getByTestId('flow-back'));
    expect(screen.getByTestId('flow-cloud')).toBeTruthy();
    fireEvent.press(screen.getByTestId('flow-next-cloud'));
    expect(screen.getByText('書いたもの')).toBeTruthy();
  });

  it('lets a change of mind about discarding leave everything where it was', () => {
    const onDiscard = jest.fn();
    render(<FlowQuest last={null} onSave={jest.fn()} onDiscard={onDiscard} />);
    walkTo('rain');
    fireEvent.changeText(screen.getByTestId('flow-input-rain'), '消したくないもの');
    for (const id of ['rain', 'river', 'ocean', 'cloud'] as const) leave(id);
    fireEvent.press(screen.getByTestId('flow-discard'));
    fireEvent.press(screen.getByTestId('flow-drop-no'));
    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.getByText('消したくないもの')).toBeTruthy();
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
