import { fireEvent, render, screen } from '@testing-library/react-native';
import { GainComposer } from '../components/log/GainComposer';
import { HOME } from '../src/constants/copy';

describe('the ten-second path', () => {
  it('shows the field immediately — there is no button to press first', () => {
    render(<GainComposer onSave={jest.fn()} />);
    expect(screen.getByTestId('entry-body-input')).toBeTruthy();
    expect(screen.getByTestId('category-chips')).toBeTruthy();
    expect(screen.getByText(HOME.question)).toBeTruthy();
  });

  it('saves after one chip and one sentence', () => {
    const onSave = jest.fn();
    render(<GainComposer onSave={onSave} />);

    fireEvent.press(screen.getByTestId('chip-progress'));
    fireEvent.changeText(screen.getByTestId('entry-body-input'), '骨組みを書き出した。');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({
      inputCategory: 'progress',
      body: '骨組みを書き出した。',
    });
  });

  it('offers exactly three drawers and no way to add a fourth', () => {
    render(<GainComposer onSave={jest.fn()} />);
    expect(screen.getByTestId('chip-progress')).toBeTruthy();
    expect(screen.getByTestId('chip-friction')).toBeTruthy();
    expect(screen.getByTestId('chip-moved')).toBeTruthy();
    expect(screen.queryByText('カテゴリーの設定')).toBeNull();
  });

  it('does not save a chip with no words, or words with no chip', () => {
    const onSave = jest.fn();
    render(<GainComposer onSave={onSave} />);

    fireEvent.press(screen.getByTestId('chip-friction'));
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('entry-body-input'), '   ');
    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('empties itself after a save so the next record starts clean', () => {
    const onSave = jest.fn();
    render(<GainComposer onSave={onSave} />);

    fireEvent.press(screen.getByTestId('chip-moved'));
    fireEvent.changeText(screen.getByTestId('entry-body-input'), '常設展を見に行った。');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(screen.getByTestId('entry-body-input').props.value).toBe('');

    fireEvent.press(screen.getByTestId('composer-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('asks no question about meaning', () => {
    render(<GainComposer onSave={jest.fn()} />);
    for (const banned of ['なぜ', 'どんな学び', 'どんな意味', '次は何を']) {
      expect(screen.queryByText(new RegExp(banned))).toBeNull();
    }
  });
});
