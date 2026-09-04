/**
 * Composer contract: type, category and body are all required, and the
 * ×/✓ controls behave as specified.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LogComposer } from '@components/log/LogComposer';
import type { Category } from '@/types';

const categories: Category[] = [
  {
    id: 'cat-1',
    name: 'ときめき',
    slug: 'tokimeki',
    sortOrder: 0,
    isActive: true,
    isDefault: true,
    promptExamples: ['今日ちょっと「いいな」と思ったことは？'],
  },
  {
    id: 'cat-2',
    name: '積み上げ',
    slug: 'tsumiage',
    sortOrder: 1,
    isActive: true,
    isDefault: true,
    promptExamples: ['今日、少しでも手を動かしたことは？'],
  },
];

describe('LogComposer', () => {
  it('refuses to save without a category', () => {
    const onSave = jest.fn();
    render(
      <LogComposer visible categories={categories} onClose={jest.fn()} onSave={onSave} />
    );

    fireEvent.press(screen.getByTestId('log-type-event'));
    fireEvent.changeText(screen.getByTestId('log-body-input'), '展示を見に行った');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('カテゴリーを選んでください。')).toBeTruthy();
  });

  it('refuses to save without a type', () => {
    const onSave = jest.fn();
    render(
      <LogComposer visible categories={categories} onClose={jest.fn()} onSave={onSave} />
    );

    fireEvent.press(screen.getByTestId('category-tokimeki'));
    fireEvent.changeText(screen.getByTestId('log-body-input'), '展示を見に行った');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('refuses to save an empty body', () => {
    const onSave = jest.fn();
    render(
      <LogComposer visible categories={categories} onClose={jest.fn()} onSave={onSave} />
    );

    fireEvent.press(screen.getByTestId('log-type-thought'));
    fireEvent.press(screen.getByTestId('category-tokimeki'));
    fireEvent.changeText(screen.getByTestId('log-body-input'), '   ');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves once type, category and body are all present', () => {
    const onSave = jest.fn();
    render(
      <LogComposer visible categories={categories} onClose={jest.fn()} onSave={onSave} />
    );

    fireEvent.press(screen.getByTestId('log-type-thought'));
    fireEvent.press(screen.getByTestId('category-tsumiage'));
    fireEvent.changeText(screen.getByTestId('log-body-input'), '小さく前に進んだ気がする');
    fireEvent.press(screen.getByTestId('composer-save'));

    expect(onSave).toHaveBeenCalledWith({
      type: 'thought',
      categoryId: 'cat-2',
      body: '小さく前に進んだ気がする',
    });
  });

  it('shows one guidance prompt for the selected category', () => {
    render(<LogComposer visible categories={categories} onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.queryByTestId('category-prompt')).toBeNull();
    fireEvent.press(screen.getByTestId('category-tokimeki'));
    expect(screen.getByTestId('category-prompt')).toBeTruthy();
  });

  it('× clears the form', () => {
    render(<LogComposer visible categories={categories} onClose={jest.fn()} onSave={jest.fn()} />);

    fireEvent.press(screen.getByTestId('log-type-event'));
    fireEvent.press(screen.getByTestId('category-tokimeki'));
    fireEvent.changeText(screen.getByTestId('log-body-input'), '書きかけの本文');

    fireEvent.press(screen.getByTestId('composer-reset'));

    expect(screen.getByTestId('log-body-input').props.value).toBe('');
    expect(screen.queryByTestId('category-prompt')).toBeNull();
  });
});
