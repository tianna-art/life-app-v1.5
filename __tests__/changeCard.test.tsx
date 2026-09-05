import { render, fireEvent } from '@testing-library/react-native';
import { ChangeCard } from '../components/map/ChangeCard';
import { CHANGE } from '../src/constants/copy';
import type { Change } from '../src/types';

const change = (overrides: Partial<Change> = {}): Change =>
  ({
    id: 'c1',
    userId: 'u1',
    periodType: 'month',
    year: 2026,
    month: 9,
    title: '自分の基準で選ぶ',
    linkedTargetType: 'desired_self',
    linkedTargetId: 'choose_decide_myself',
    linkedTargetLabel: '自分で決められる',
    currentState: '基準を使って選んでいる',
    observation: '選択肢を考えるだけでなく、実際に一つを選ぶ記録が出てきています。',
    targetConnection: '判断基準を実際の選択に使い始めた変化です。',
    confidence: 'supported',
    position: 0,
    userEdited: false,
    evidence: [
      {
        logId: 'l1',
        occurredOn: '2026-09-01',
        role: 'attempt',
        text: '次の半年で試す選択を一つ決める',
        logType: 'thought',
        momentTags: [],
      },
      {
        logId: 'l2',
        occurredOn: '2026-09-07',
        role: 'change',
        text: '証拠がある方向を小さく選びたい',
        logType: 'thought',
        momentTags: [],
      },
    ],
    gains: [],
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  }) as Change;

const noop = () => undefined;

/**
 * §26 and §27. The order is the argument.
 *
 * Reading the interpretation first and the evidence afterwards makes the
 * evidence look selected to fit. Reading the records first means the person
 * can disagree before being told what to think — which is the only way
 * "確かに、この記録があるなら" is available to them at all.
 */
describe('the summary card', () => {
  it('prints the records before it says anything about them', () => {
    const tree = render(
      <ChangeCard
        change={change()}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={noop}
        onVerdict={noop}
      />
    ).toJSON();

    const lines: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') {
        lines.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node && typeof node === 'object' && 'children' in node) {
        walk((node as { children: unknown }).children);
      }
    };
    walk(tree);

    const at = (text: string) => lines.indexOf(text);
    expect(at(CHANGE.fromRecords)).toBeGreaterThan(-1);
    expect(at('次の半年で試す選択を一つ決める')).toBeGreaterThan(at(CHANGE.fromRecords));
    expect(at(CHANGE.observation)).toBeGreaterThan(at('次の半年で試す選択を一つ決める'));
    expect(at(CHANGE.targetConnection)).toBeGreaterThan(at(CHANGE.observation));
  });

  it("shows the person's own words, not a summary of them", () => {
    const { getByText } = render(
      <ChangeCard
        change={change()}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={noop}
        onVerdict={noop}
      />
    );
    expect(getByText('次の半年で試す選択を一つ決める')).toBeTruthy();
    expect(getByText('証拠がある方向を小さく選びたい')).toBeTruthy();
  });

  it('names the thing the person put down, in their wording (§14)', () => {
    const { getByText } = render(
      <ChangeCard
        change={change()}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={noop}
        onVerdict={noop}
      />
    );
    expect(getByText('「自分で決められる」')).toBeTruthy();
  });

  it('prints no before state when there is none (§16)', () => {
    const { queryByText } = render(
      <ChangeCard
        change={change()}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={noop}
        onVerdict={noop}
      />
    );
    // No section, no placeholder, no "以前のことは分かりません". Absent.
    expect(queryByText(CHANGE.before)).toBeNull();
  });

  it('offers the rest of the records only when there are more (§26)', () => {
    const two = render(
      <ChangeCard
        change={change()}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={noop}
        onVerdict={noop}
      />
    );
    expect(two.queryByTestId('change-evidence-all-c1')).toBeNull();

    const four = change({
      evidence: [
        ...change().evidence,
        {
          logId: 'l3',
          occurredOn: '2026-09-20',
          role: 'evidence',
          text: '三つ目',
          logType: 'thought',
          momentTags: [],
        },
        {
          logId: 'l4',
          occurredOn: '2026-09-28',
          role: 'current',
          text: '四つ目',
          logType: 'thought',
          momentTags: [],
        },
      ],
    });
    const seen: string[][] = [];
    const many = render(
      <ChangeCard
        change={four}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={(ids) => seen.push([...ids])}
        onVerdict={noop}
      />
    );
    fireEvent.press(many.getByTestId('change-evidence-all-c1'));
    // All four, not the three that were on screen.
    expect(seen[0]).toEqual(['l1', 'l2', 'l3', 'l4']);
  });

  it('takes the person answer to the reading', () => {
    const answers: string[] = [];
    const { getByTestId } = render(
      <ChangeCard
        change={change()}
        focused={false}
        onOpenLog={noop}
        onOpenAllEvidence={noop}
        onVerdict={(v) => answers.push(v)}
      />
    );
    fireEvent.press(getByTestId('change-accepted-c1'));
    fireEvent.press(getByTestId('change-adjusted-c1'));
    expect(answers).toEqual(['accepted', 'adjusted']);
  });
});
