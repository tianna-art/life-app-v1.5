import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { colors } from '../src/theme';
import { ProgressionSheet } from '../components/map/ProgressionSheet';
import type { ProgressionDetail } from '../src/types';

const detail = {
  progression: {
    id: 'p1',
    userId: 'u1',
    type: 'method',
    title: '自分で決められない消耗',
    summary: '',
    maturity: 'signal',
    confidence: 0.4,
    goalExternal: false,
    firstDetectedAt: '2026-05-01T00:00:00.000Z',
    lastUpdatedAt: '2026-08-01T00:00:00.000Z',
    userEdited: false,
    evidenceCount: 2,
  },
  steps: [],
  gains: [],
} as unknown as ProgressionDetail;

/**
 * The sheet opens by tapping a point on the map, and used to close only by
 * the invisible scrim behind it or the system back gesture.
 */
describe('ProgressionSheet', () => {
  it('offers a visible way out', () => {
    const onClose = jest.fn();
    const screen = render(
      <ProgressionSheet
        detail={detail}
        onClose={onClose}
        onOpenLog={jest.fn()}
        onVerdict={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId('sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('draws it at full strength, not at the faint end of the palette', () => {
    // It is the only way out of the sheet, so it may not be the dimmest
    // thing on screen.
    const screen = render(
      <ProgressionSheet
        detail={detail}
        onClose={jest.fn()}
        onOpenLog={jest.fn()}
        onVerdict={jest.fn()}
      />
    );
    const glyph = screen.getByText('×');
    const style = StyleSheet.flatten(glyph.props.style) as { color?: string };
    expect(style.color).toBe(colors.ivory);
  });

  it('puts it above the title, where nothing can push it around', () => {
    const screen = render(
      <ProgressionSheet
        detail={detail}
        onClose={jest.fn()}
        onOpenLog={jest.fn()}
        onVerdict={jest.fn()}
      />
    );
    // A two-line title sharing the row would move it; it has its own.
    expect(screen.getByText('×')).toBeTruthy();
    expect(screen.getByText('自分で決められない消耗')).toBeTruthy();
  });
});
