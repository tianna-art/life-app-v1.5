/**
 * The menu is the only place a session can be ended, and the settings mark is
 * the shortcut that sits beside the drawers it edits.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LogMenu } from '@components/log/LogMenu';
import { CategorySelector } from '@components/log/CategorySelector';
import type { Category } from '@/types';

const categories: Category[] = [
  {
    id: 'cat-1',
    name: '楽しかったこと',
    slug: 'tokimeki',
    sortOrder: 0,
    isActive: true,
    isDefault: true,
    icon: 'starburst',
    promptExamples: [],
  },
];

describe('LogMenu', () => {
  it('asks once before ending the session, and only acts on the second tap', () => {
    const onSignOut = jest.fn();
    const onClose = jest.fn();
    render(
      <LogMenu
        visible
        onClose={onClose}
        items={[
          { label: 'カテゴリーの設定', onPress: jest.fn() },
          {
            label: 'ログアウト',
            onPress: onSignOut,
            separated: true,
            confirmLabel: 'もう一度押すとログアウト',
          },
        ]}
      />
    );

    fireEvent.press(screen.getByTestId('menu-ログアウト'));
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByText('もう一度押すとログアウト')).toBeTruthy();

    fireEvent.press(screen.getByTestId('menu-ログアウト'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('acts immediately on an item that asks for no confirmation', () => {
    const onPress = jest.fn();
    render(
      <LogMenu visible onClose={jest.fn()} items={[{ label: '一年を読み返す', onPress }]} />
    );
    fireEvent.press(screen.getByTestId('menu-一年を読み返す'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('CategorySelector', () => {
  it('offers the settings mark beside the drawers', () => {
    const onOpenSettings = jest.fn();
    render(
      <CategorySelector
        categories={categories}
        value={null}
        onChange={jest.fn()}
        onOpenSettings={onOpenSettings}
      />
    );
    fireEvent.press(screen.getByTestId('open-category-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('draws no settings mark when there is nowhere to go', () => {
    render(<CategorySelector categories={categories} value={null} onChange={jest.fn()} />);
    expect(screen.queryByTestId('open-category-settings')).toBeNull();
  });

  it('still selects a category — the mark did not take the tap', () => {
    const onChange = jest.fn();
    render(
      <CategorySelector
        categories={categories}
        value={null}
        onChange={onChange}
        onOpenSettings={jest.fn()}
      />
    );
    fireEvent.press(screen.getByTestId('category-tokimeki'));
    expect(onChange).toHaveBeenCalledWith('cat-1');
  });
});
