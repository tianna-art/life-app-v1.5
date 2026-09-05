import { StyleSheet, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { TopBar } from '../components/ui/TopBar';

/**
 * Every screen opens with this bar, and the point of it is that the middle of
 * one screen's bar is the middle of the next one's — a menu on the right must
 * not shift the plate.
 */
describe('TopBar', () => {
  const flatten = (style: unknown): Record<string, unknown> =>
    (StyleSheet.flatten(style as never) as Record<string, unknown> | undefined) ?? {};

  it('centres what it holds', () => {
    const screen = render(
      <TopBar>
        <Text>2026.09</Text>
      </TopBar>
    );
    const centre = screen.getByTestId('top-bar').props.children[0];
    expect(flatten(centre.props.style).alignItems).toBe('center');
  });

  it('lays the right-hand slot over the bar rather than in it', () => {
    // In the row, a menu button would push the plate off-centre.
    const screen = render(
      <TopBar right={<Text testID="menu">…</Text>}>
        <Text>2026</Text>
      </TopBar>
    );
    const slot = screen.getByTestId('menu').parent;
    let node = slot;
    let found = false;
    while (node && !found) {
      if (flatten(node.props?.style).position === 'absolute') found = true;
      node = node.parent;
    }
    expect(found).toBe(true);
  });

  it('offers the way back only when there is one', () => {
    const plain = render(<TopBar><Text>2026</Text></TopBar>);
    expect(plain.queryByTestId('top-bar-back')).toBeNull();

    const onBack = jest.fn();
    const withBack = render(<TopBar onBack={onBack} />);
    fireEvent.press(withBack.getByTestId('top-bar-back'));
    expect(onBack).toHaveBeenCalled();
  });
});
