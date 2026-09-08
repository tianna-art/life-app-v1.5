import { render } from '@testing-library/react-native';
import { LogRow } from '../components/list/LogRow';
import { categoryLabel, detailLabel } from '../src/constants/log';
import type { DailyLog } from '../src/types';

const base: DailyLog = {
  id: 'l1',
  userId: 'u1',
  occurredAt: '2026-09-05T09:00:00.000Z',
  occurredOn: '2026-09-05',
  categoryId: 'progress_tried',
  detailId: 'talked',
  inputMethod: 'category',
  classificationSource: 'user',
  classificationStatus: 'confirmed',
  aiSignals: [],
  createdAt: '2026-09-05T09:00:00.000Z',
};

/**
 * LIST is where someone looks a record up (§28), so the row has to be readable
 * on its own: the date, what it was filed under, and whatever they wrote.
 */
describe('LogRow', () => {
  it('shows what the record was filed under', () => {
    const screen = render(<LogRow entry={base} onPress={jest.fn()} />);

    expect(screen.getByText(categoryLabel('progress_tried'))).toBeTruthy();
    expect(screen.getByText(detailLabel('progress_tried', 'talked'))).toBeTruthy();
  });

  it('does not print the antenna on every row', () => {
    // It is a filter above the list, which is where it earns its place.
    // Repeated on each row it only competes with the person's own words.
    const screen = render(<LogRow entry={base} onPress={jest.fn()} />);
    expect(screen.queryByText('前進')).toBeNull();
  });

  it('prints what an old row carries rather than filing it for them', () => {
    // A record written before the antennas has no category. Guessing one
    // would file it under a vocabulary the person never saw.
    const legacy = {
      ...base,
      categoryId: undefined,
      detailId: undefined,
      legacyMomentTags: ['friction' as const],
    };
    const screen = render(<LogRow entry={legacy} onPress={jest.fn()} />);
    expect(screen.getByText('モヤモヤ')).toBeTruthy();
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
      <LogRow entry={{ ...base, body: long }} onPress={jest.fn()} />
    );
    const written = screen.getByText(long);
    expect(written).toBeTruthy();
    expect(written.props.numberOfLines).toBeUndefined();
    expect(long).not.toContain('…');
  });

  it('draws しんどかった exactly like every other category', () => {
    // Being hard is not a failure, so nothing in the row may set it apart.
    const hard = render(
      <LogRow entry={{ ...base, categoryId: 'self_hard', detailId: 'people' }} onPress={jest.fn()} />
    ).getByText(categoryLabel('self_hard'));
    const did = render(
      <LogRow entry={{ ...base, categoryId: 'progress_did', detailId: 'first_time' }} onPress={jest.fn()} />
    ).getByText(categoryLabel('progress_did'));
    expect(hard.props.style).toEqual(did.props.style);
  });
});
