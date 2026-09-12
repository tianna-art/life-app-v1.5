/**
 * 見えてきたこと.
 *
 * The product rests on one rule: a reading with nothing behind it is not
 * produced. A screen that fills an empty band with plausible sentences breaks
 * that rule just as surely as a model that invents them, so the empty case is
 * tested as carefully as the full one.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { InsightCards } from '@components/map/InsightCards';
import { StarredMemos } from '@components/map/StarredMemos';
import type { FutureMemo, MonthInsight } from '@/types';

function insight(id: string, evidence: string[], over: Partial<MonthInsight> = {}): MonthInsight {
  return {
    id,
    periodKey: '2026-09',
    antennaId: 'progress',
    label: '積み上がったこと',
    text: `見立て ${id}`,
    why: '',
    note: '',
    evidenceLogIds: evidence,
    ...over,
  };
}

describe('an empty month', () => {
  it('says the band is waiting, and invents nothing', () => {
    render(<InsightCards insights={[]} hypothesis={null} onOpen={jest.fn()} />);
    expect(screen.getByTestId('insights-empty')).toBeTruthy();
    expect(screen.queryByTestId('insight-cards')).toBeNull();
  });
});

describe('what a card shows about its own evidence', () => {
  it('names the number of records behind it', () => {
    render(
      <InsightCards insights={[insight('a', ['l1', 'l2'])]} hypothesis={null} onOpen={jest.fn()} />
    );
    expect(screen.getByText(/関連する記録 2 件/)).toBeTruthy();
  });

  it('says so when there is only one, rather than counting it as a pattern', () => {
    render(<InsightCards insights={[insight('a', ['l1'])]} hypothesis={null} onOpen={jest.fn()} />);
    expect(screen.getByText('1件の記録から')).toBeTruthy();
  });

  it('opens the records themselves — a reading must be traceable', () => {
    const onOpen = jest.fn();
    const card = insight('a', ['l1', 'l2']);
    render(<InsightCards insights={[card]} hypothesis={null} onOpen={onOpen} />);
    fireEvent.press(screen.getByTestId('insight-a'));
    expect(onOpen).toHaveBeenCalledWith(card);
  });
});

describe('how many cards a month may show', () => {
  it('stops at four, however many were written', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => insight(id, ['l1', 'l2']));
    render(<InsightCards insights={many} hypothesis={null} onOpen={jest.fn()} />);
    expect(screen.queryByTestId('insight-d')).toBeTruthy();
    expect(screen.queryByTestId('insight-e')).toBeNull();
  });

  it('shows 今の仮説 only when there is one', () => {
    render(<InsightCards insights={[insight('a', ['l1'])]} hypothesis={null} onOpen={jest.fn()} />);
    expect(screen.queryByTestId('insight-hypothesis')).toBeNull();

    render(
      <InsightCards
        insights={[insight('a', ['l1'])]}
        hypothesis={{ periodKey: '2026-09', text: '〜かもしれません。', updatedAt: '' }}
        onOpen={jest.fn()}
      />
    );
    expect(screen.getByTestId('insight-hypothesis')).toBeTruthy();
  });
});

function memo(id: string, over: Partial<FutureMemo> = {}): FutureMemo {
  return {
    id,
    type: 'place',
    title: `メモ ${id}`,
    memo: '',
    targetDate: null,
    dateKind: 'none',
    favorite: true,
    status: 'future',
    completedAt: null,
    heartTags: [],
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  };
}

describe('心に浮かんだこと', () => {
  it('shows only what was starred', () => {
    render(
      <StarredMemos
        memos={[memo('a'), memo('b', { favorite: false })]}
        onSeeAll={jest.fn()}
        onAdd={jest.fn()}
      />
    );
    expect(screen.getByTestId('starred-a')).toBeTruthy();
    expect(screen.queryByTestId('starred-b')).toBeNull();
  });

  it('leaves a finished one off the map — this is what is ahead, not behind', () => {
    render(
      <StarredMemos memos={[memo('a', { status: 'completed' })]} onSeeAll={jest.fn()} onAdd={jest.fn()} />
    );
    expect(screen.queryByTestId('starred-a')).toBeNull();
  });

  it('shows at most three', () => {
    render(
      <StarredMemos
        memos={['a', 'b', 'c', 'd'].map((id) => memo(id))}
        onSeeAll={jest.fn()}
        onAdd={jest.fn()}
      />
    );
    expect(screen.queryByTestId('starred-c')).toBeTruthy();
    expect(screen.queryByTestId('starred-d')).toBeNull();
  });

  it('never counts what is left — a shelf of ideas is not a backlog', () => {
    render(
      <StarredMemos
        memos={['a', 'b', 'c', 'd', 'e'].map((id) => memo(id))}
        onSeeAll={jest.fn()}
        onAdd={jest.fn()}
      />
    );
    expect(screen.queryByText(/5/)).toBeNull();
    expect(screen.queryByText(/残り/)).toBeNull();
    expect(screen.queryByText(/件/)).toBeNull();
  });
});
