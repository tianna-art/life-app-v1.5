import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DailyComposer } from '../components/log/DailyComposer';

const noQuestion = () => Promise.resolve(null);

/**
 * §14's target is 5-15 seconds, and §14 is explicit that a record with no free
 * text is a complete record. These tests hold both.
 */
describe('DailyComposer', () => {
  it('saves with a door and a tag, and nothing else (§14)', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer onSave={onSave} onNeedQuestion={noQuestion} />);

    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('level1-self_action'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('moment-tried'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({ logType: 'self_action', momentTags: ['tried'] });
  });

  it('takes more than one moment tag at once (§10)', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer onSave={onSave} onNeedQuestion={noQuestion} />);

    fireEvent.press(screen.getByTestId('level1-relationship'));
    fireEvent.press(screen.getByTestId('moment-first_time'));
    fireEvent.press(screen.getByTestId('moment-enjoyed'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({
      logType: 'relationship',
      momentTags: ['first_time', 'enjoyed'],
    });
  });

  it('lets a tag be untapped', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer onSave={onSave} onNeedQuestion={noQuestion} />);

    fireEvent.press(screen.getByTestId('level1-thought'));
    fireEvent.press(screen.getByTestId('moment-friction'));
    fireEvent.press(screen.getByTestId('moment-discovered'));
    fireEvent.press(screen.getByTestId('moment-friction'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({ logType: 'thought', momentTags: ['discovered'] });
  });

  it('offers three doors and seven tags (§9, §10)', () => {
    const screen = render(<DailyComposer onSave={jest.fn()} onNeedQuestion={noQuestion} />);
    for (const door of ['self_action', 'relationship', 'thought']) {
      expect(screen.getByTestId(`level1-${door}`)).toBeTruthy();
    }
    for (const tag of [
      'enjoyed',
      'tried',
      'first_time',
      'friction',
      'changed',
      'discovered',
      'self_decided',
    ]) {
      expect(screen.getByTestId(`moment-${tag}`)).toBeTruthy();
    }
  });

  it('asks the question only once there is something to ask about', async () => {
    const onNeedQuestion = jest.fn().mockResolvedValue('前と何を変えた？');
    const screen = render(<DailyComposer onSave={jest.fn()} onNeedQuestion={onNeedQuestion} />);

    expect(screen.queryByTestId('level3')).toBeNull();
    expect(onNeedQuestion).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId('level1-self_action'));
      fireEvent.press(screen.getByTestId('moment-changed'));
    });

    await waitFor(() => expect(screen.getByTestId('level3')).toBeTruthy());
    expect(onNeedQuestion).toHaveBeenCalledWith({
      logType: 'self_action',
      momentTags: ['changed'],
    });
  });

  it('keeps the question with its answer when one is given (§11)', async () => {
    const onSave = jest.fn();
    const screen = render(
      <DailyComposer
        onSave={onSave}
        onNeedQuestion={() => Promise.resolve('前と何を変えた？')}
      />
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('level1-self_action'));
      fireEvent.press(screen.getByTestId('moment-changed'));
    });
    await waitFor(() => expect(screen.getByTestId('answer-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('answer-input'), '結論から話した');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({
      logType: 'self_action',
      momentTags: ['changed'],
      aiQuestion: '前と何を変えた？',
      optionalAnswer: '結論から話した',
    });
  });

  it('does not save whitespace as an answer', async () => {
    const onSave = jest.fn();
    const screen = render(
      <DailyComposer onSave={onSave} onNeedQuestion={() => Promise.resolve('誰に見せた？')} />
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('level1-relationship'));
      fireEvent.press(screen.getByTestId('moment-tried'));
    });
    await waitFor(() => expect(screen.getByTestId('answer-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('answer-input'), '   ');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.not.objectContaining({ optionalAnswer: expect.anything() })
    );
  });

  it('clears itself after a save', () => {
    const onSave = jest.fn();
    const screen = render(<DailyComposer onSave={onSave} onNeedQuestion={noQuestion} />);

    fireEvent.press(screen.getByTestId('level1-self_action'));
    fireEvent.press(screen.getByTestId('moment-tried'));
    fireEvent.press(screen.getByTestId('composer-save'));

    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
