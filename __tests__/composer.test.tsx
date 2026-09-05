import { fireEvent, render } from '@testing-library/react-native';
import { EntryComposer } from '../components/log/EntryComposer';

/**
 * §4's target is ten seconds: type, sentence, mark, ✓. These tests hold the
 * shape of that path — that nothing extra is required, and that nothing is
 * saved before all three parts are present.
 */
describe('EntryComposer', () => {
  it('needs a type, a body and a signal — and nothing else', () => {
    const onSave = jest.fn();
    const screen = render(<EntryComposer onSave={onSave} />);

    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('type-event'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('entry-body-input'), '初めて友達に見せた');
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('signal-positive'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({
      type: 'event',
      body: '初めて友達に見せた',
      subjectiveSignal: 'positive',
    });
  });

  it('offers exactly two types and three signals (§3)', () => {
    const screen = render(<EntryComposer onSave={jest.fn()} />);
    expect(screen.getByTestId('type-event')).toBeTruthy();
    expect(screen.getByTestId('type-thought')).toBeTruthy();
    expect(screen.getByTestId('signal-positive')).toBeTruthy();
    expect(screen.getByTestId('signal-mixed')).toBeTruthy();
    expect(screen.getByTestId('signal-negative')).toBeTruthy();
  });

  it('clears itself after a save so the next record starts empty', () => {
    const onSave = jest.fn();
    const screen = render(<EntryComposer onSave={onSave} />);

    fireEvent.press(screen.getByTestId('type-thought'));
    fireEvent.changeText(screen.getByTestId('entry-body-input'), '人に見せるのが怖い');
    fireEvent.press(screen.getByTestId('signal-negative'));
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(screen.getByTestId('entry-body-input').props.value).toBe('');
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not save whitespace', () => {
    const onSave = jest.fn();
    const screen = render(<EntryComposer onSave={onSave} />);

    fireEvent.press(screen.getByTestId('type-event'));
    fireEvent.press(screen.getByTestId('signal-mixed'));
    fireEvent.changeText(screen.getByTestId('entry-body-input'), '   ');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).not.toHaveBeenCalled();
  });
});
