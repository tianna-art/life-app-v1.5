import { render } from '@testing-library/react-native';
import { LogRow } from '../components/list/LogRow';
import { logTypeLabel, momentTagLabel } from '../src/constants/log';
import type { DailyLog } from '../src/types';

const base: DailyLog = {
  id: 'l1',
  userId: 'u1',
  occurredAt: '2026-09-05T09:00:00.000Z',
  occurredOn: '2026-09-05',
  logType: 'relationship',
  momentTags: ['first_time', 'friction'],
  createdAt: '2026-09-05T09:00:00.000Z',
};

/**
 * LIST is where someone looks a record up (§28), so the row has to be readable
 * on its own. In v4 that means the category and the moment tags: there is no
 * separate feeling field to show, and most records have no free text at all.
 */
describe('LogRow', () => {
  it('shows the category and the moment tags', () => {
    const screen = render(<LogRow entry={base} onPress={jest.fn()} />);

    expect(screen.getByText(logTypeLabel('relationship'))).toBeTruthy();
    expect(screen.getByText(momentTagLabel('first_time'))).toBeTruthy();
    expect(screen.getByText(momentTagLabel('friction'))).toBeTruthy();
  });

  it('is a complete row with no free text (§14)', () => {
    const screen = render(<LogRow entry={base} onPress={jest.fn()} />);
    expect(screen.getByTestId('log-row-l1')).toBeTruthy();
  });

  it('shows what the person wrote, whole', () => {
    // The archive is for reading, not for tapping through: nothing is cut.
    const long =
      '仕事のあとに自分が担当したい役割を言語化。少しだけでも手を動かすと、' +
      '考えているだけの時より気持ちが落ち着いた。';
    const screen = render(
      <LogRow entry={{ ...base, optionalAnswer: long }} onPress={jest.fn()} />
    );
    const written = screen.getByText(long);
    expect(written).toBeTruthy();
    expect(written.props.numberOfLines).toBeUndefined();
    expect(long).not.toContain('…');
  });

  it('draws モヤモヤ exactly like every other tag (§10)', () => {
    // 'friction' is not a failure, so nothing in the row may set it apart.
    const screen = render(<LogRow entry={base} onPress={jest.fn()} />);
    const friction = screen.getByText(momentTagLabel('friction'));
    const firstTime = screen.getByText(momentTagLabel('first_time'));
    expect(friction.props.style).toEqual(firstTime.props.style);
  });
});
