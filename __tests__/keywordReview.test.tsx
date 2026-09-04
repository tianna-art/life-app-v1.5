/**
 * Keyword confirmation: 編集 ｜ スキップ ｜ 納得した, with 納得した always last.
 */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { KeywordReview } from '@components/map/KeywordReview';
import type { KeywordCandidate } from '@/types';

const keywords: KeywordCandidate[] = [
  { label: '裁量', confidence: 0.92, evidenceLogIds: ['l1'] },
  { label: '制作', confidence: 0.86, evidenceLogIds: ['l2'] },
  { label: '新しい人', confidence: 0.79, evidenceLogIds: ['l3'] },
];

type Props = React.ComponentProps<typeof KeywordReview>;

function setup(overrides: Partial<Props> = {}) {
  const onEditConfirm = jest.fn<void, [KeywordCandidate[]]>();
  const onSkip = jest.fn();
  const onAccept = jest.fn();
  const props: Props = { keywords, status: 'pending', onEditConfirm, onSkip, onAccept, ...overrides };
  render(<KeywordReview {...props} />);
  return { onEditConfirm, onSkip, onAccept };
}

describe('KeywordReview', () => {
  it('shows at most three keywords', () => {
    setup({
      keywords: [...keywords, { label: '四つ目', confidence: 0.4, evidenceLogIds: [] }],
    });
    expect(screen.getByText('#裁量')).toBeTruthy();
    expect(screen.getByText('#新しい人')).toBeTruthy();
    expect(screen.queryByText('#四つ目')).toBeNull();
  });

  it('never renders a confidence value', () => {
    setup();
    expect(screen.queryByText(/0\.9/)).toBeNull();
    expect(screen.queryByText(/92/)).toBeNull();
  });

  it('places 納得した at the rightmost position', () => {
    setup();
    const actions = screen.getByTestId('keyword-actions');
    const labels = within(actions)
      .getAllByRole('button')
      .map((node) => node.props.accessibilityLabel);
    expect(labels).toEqual(['編集', 'スキップ', '納得した']);
    expect(labels[labels.length - 1]).toBe('納得した');
  });

  it('納得した accepts the proposal as-is', () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('keyword-action-accept'));
    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
    expect(handlers.onEditConfirm).not.toHaveBeenCalled();
  });

  it('スキップ defers without confirming', () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('keyword-action-skip'));
    expect(handlers.onSkip).toHaveBeenCalledTimes(1);
    expect(handlers.onAccept).not.toHaveBeenCalled();
  });

  it('編集 lets the user replace and remove keywords, capped at three', () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('keyword-action-edit'));

    fireEvent.changeText(screen.getByTestId('keyword-input-0'), '裁量をくれる人');
    fireEvent.changeText(screen.getByTestId('keyword-input-2'), '');
    fireEvent.press(screen.getByText('このキーワードにする'));

    expect(handlers.onEditConfirm).toHaveBeenCalledTimes(1);
    const saved = handlers.onEditConfirm.mock.calls[0]![0];
    expect(saved.map((k) => k.label)).toEqual(['裁量をくれる人', '制作']);
    expect(saved.length).toBeLessThanOrEqual(3);
  });

  it('keeps the evidence of untouched keywords when edited', () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('keyword-action-edit'));
    fireEvent.press(screen.getByText('このキーワードにする'));

    const saved = handlers.onEditConfirm.mock.calls[0]![0];
    expect(saved[0]).toMatchObject({ label: '裁量', evidenceLogIds: ['l1'] });
  });

  it('reports an already-reviewed state without scoring it', () => {
    setup({ status: 'accepted' });
    expect(screen.getByText('このキーワードは確認済みです。')).toBeTruthy();
  });
});
