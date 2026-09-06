import {
  MAX_CHANGES,
  capConfidence,
  confidenceCeiling,
  isTopicTitle,
  parseChangeReading,
  type ChangeContext,
} from '@/ai/changeRules';

/**
 * §43 is written as ten questions the model should ask itself.
 *
 * A model asked to check its own work answers that it checked. These are the
 * answers being taken out of its hands: every one of them is a candidate the
 * model returned in good faith and the code refused.
 */
function context(overrides: Partial<ChangeContext> = {}): ChangeContext {
  return {
    knownLogIds: new Set(['a', 'b', 'c', 'old']),
    monthLogIds: new Set(['a', 'b', 'c']),
    knownProgressionIds: new Set(['p1']),
    targets: new Map([
      ['month_declaration', new Map([['2026-09', '次の一歩を選ぶ']])],
      ['year_direction', new Map([['own_axis', '自分の軸で決められるようになりたい']])],
      ['desired_self', new Map([['choose_decide_myself', '自分で決められる']])],
      ['emerging_direction', new Map()],
    ]),
    frictionOnlyLogIds: new Set(),
    enjoyedOnlyLogIds: new Set(),
    ...overrides,
  };
}

function change(overrides: Record<string, unknown> = {}) {
  return {
    title: '自分の基準で選ぶ',
    linked_target_type: 'desired_self',
    linked_target_id: 'choose_decide_myself',
    linked_target_label: '自分で決められる',
    current_state: '基準を使って選んでいる',
    observation: '選択肢を並べるだけでなく、実際に一つを選ぶ記録が出ています。',
    target_connection: '「自分で決められる」に対して、判断基準を実際の選択に使い始めた変化です。',
    confidence: 'supported',
    evidence: [
      { log_id: 'a', role: 'attempt' },
      { log_id: 'b', role: 'current' },
    ],
    gains: [],
    ...overrides,
  };
}

function read(changes: unknown[], ctx = context()) {
  return parseChangeReading({ changes }, ctx);
}

describe('what a title may be (§19)', () => {
  it.each(['キャリア', '仕事', '人間関係', 'モヤモヤ', '計画', 'デザイン', '自分'])(
    'refuses %s, which says what the writing was about',
    (title) => {
      expect(isTopicTitle(title)).toBe(true);
    }
  );

  it.each([
    '自分の基準で選ぶ',
    '人に見せる範囲を広げる',
    '試しながら伝え方を変える',
    '仕事以外の時間を守る',
  ])('keeps %s, which says what moved', (title) => {
    expect(isTopicTitle(title)).toBe(false);
  });

  it('refuses a diagnosis of the person (§30)', () => {
    expect(isTopicTitle('自己決定性が向上')).toBe(true);
    expect(isTopicTitle('主体的になった')).toBe(true);
  });

  it('drops a topic title rather than rewording it', () => {
    const { changes, rejected } = read([change({ title: '仕事' })]);
    expect(changes).toEqual([]);
    expect(rejected[0]?.reason).toContain('何が変わったか');
  });
});

describe('how much has to be behind a change (§20, §36)', () => {
  it('refuses one record, however clearly it reads', () => {
    const { changes } = read([change({ evidence: [{ log_id: 'a', role: 'current' }] })]);
    expect(changes).toEqual([]);
  });

  it('ignores record ids it was never given', () => {
    const { changes } = read([
      change({
        evidence: [
          { log_id: 'a', role: 'attempt' },
          { log_id: 'invented', role: 'current' },
        ],
      }),
    ]);
    // One real record left, which is not enough.
    expect(changes).toEqual([]);
  });

  it('counts a record only once however often it is cited', () => {
    const { changes } = read([
      change({
        evidence: [
          { log_id: 'a', role: 'attempt' },
          { log_id: 'a', role: 'current' },
        ],
      }),
    ]);
    expect(changes).toEqual([]);
  });
});

describe('never inventing a before state (§16)', () => {
  it('drops a before state with no record from before behind it', () => {
    const { changes } = read([change({ before_state: '以前は何も決められなかった' })]);
    expect(changes[0]?.beforeState).toBeUndefined();
  });

  it('keeps one that stands on an earlier record', () => {
    const { changes } = read([
      change({
        before_state: '決める前に人に聞いていた',
        confidence: 'strong',
        evidence: [
          { log_id: 'old', role: 'before' },
          { log_id: 'a', role: 'attempt' },
          { log_id: 'b', role: 'current' },
        ],
      }),
    ]);
    expect(changes[0]?.beforeState).toBe('決める前に人に聞いていた');
  });
});

describe('how strongly it may be worded (§17)', () => {
  it('will not say "from A to B" without a record from before', () => {
    const { changes } = read([change({ confidence: 'strong' })]);
    expect(changes[0]?.confidence).toBe('supported');
  });

  it('allows strong only with a before state standing on an earlier record', () => {
    expect(
      confidenceCeiling({ evidenceCount: 3, hasBeforeEvidence: true, hasBeforeState: true })
    ).toBe('strong');
    expect(
      confidenceCeiling({ evidenceCount: 3, hasBeforeEvidence: true, hasBeforeState: false })
    ).toBe('supported');
    expect(
      confidenceCeiling({ evidenceCount: 1, hasBeforeEvidence: true, hasBeforeState: true })
    ).toBe('signal');
  });

  it('never raises what the model claimed', () => {
    expect(capConfidence('signal', 'strong')).toBe('signal');
    expect(capConfidence('strong', 'signal')).toBe('signal');
  });
});

describe('what the change answers to (§14)', () => {
  it('refuses a target the person never put down', () => {
    const { changes, rejected } = read([
      change({ linked_target_id: 'connect_ask_for_help', linked_target_label: '助けを求められる' }),
    ]);
    expect(changes).toEqual([]);
    expect(rejected[0]?.reason).toContain('本人が置いていない');
  });

  it("uses the person's own wording, not the model's paraphrase", () => {
    const { changes } = read([change({ linked_target_label: '自分で決断する力' })]);
    expect(changes[0]?.linkedTargetLabel).toBe('自分で決められる');
  });

  it('lets a direction outside what they put down through, named (§34)', () => {
    const { changes } = read([
      change({
        title: '人と体験をつくる',
        linked_target_type: 'emerging_direction',
        linked_target_id: '',
        linked_target_label: '人と体験をつくる',
      }),
    ]);
    expect(changes[0]?.linkedTargetType).toBe('emerging_direction');
    expect(changes[0]?.linkedTargetLabel).toBe('人と体験をつくる');
  });

  it('still needs the new direction to be named', () => {
    const { changes } = read([
      change({ linked_target_type: 'emerging_direction', linked_target_label: '' }),
    ]);
    expect(changes).toEqual([]);
  });
});

describe('what is not a change on its own (§34, §35)', () => {
  it('refuses one standing only on モヤモヤ', () => {
    const { changes, rejected } = read(
      [change({ title: '決められない消耗' })],
      context({ frictionOnlyLogIds: new Set(['a', 'b']) })
    );
    expect(changes).toEqual([]);
    expect(rejected[0]?.reason).toContain('モヤモヤ');
  });

  it('refuses one standing only on 楽しかった', () => {
    const { changes, rejected } = read(
      [change({ title: '企画が楽しい' })],
      context({ enjoyedOnlyLogIds: new Set(['a', 'b']) })
    );
    expect(changes).toEqual([]);
    expect(rejected[0]?.reason).toContain('方向の候補');
  });

  it('keeps one where モヤモヤ sits beside something else', () => {
    const { changes } = read([change()], context({ frictionOnlyLogIds: new Set(['a']) }));
    expect(changes).toHaveLength(1);
  });
});

describe('the card has both halves (§26, §27)', () => {
  it('refuses a change with nothing under 見えてきたこと', () => {
    expect(read([change({ observation: '' })]).changes).toEqual([]);
  });

  it('refuses one with nothing under ありたい姿とのつながり', () => {
    expect(read([change({ target_connection: '' })]).changes).toEqual([]);
  });
});

describe('one movement, one change (§42)', () => {
  it('drops a second change standing on the same records', () => {
    const { changes, rejected } = read([
      change(),
      change({ title: '他人に合わせず選ぶ', linked_target_id: 'choose_decide_myself' }),
    ]);
    expect(changes).toHaveLength(1);
    expect(rejected[0]?.reason).toContain('同じもの');
  });

  it('keeps two that stand on different records', () => {
    const { changes } = read([
      change(),
      change({
        title: '人に希望を伝える',
        evidence: [
          { log_id: 'c', role: 'attempt' },
          { log_id: 'old', role: 'before' },
        ],
      }),
    ]);
    expect(changes).toHaveLength(2);
  });

  it('no longer folds a change into another on a shared substring', () => {
    // 「人に見せる範囲を広げる」 is not 「人に見せる」 restated; it says where
    // the showing now reaches. The substring rule could not tell them apart.
    const { changes } = read([
      change({ title: '人に見せる', evidence: [{ log_id: 'a', role: 'attempt' }, { log_id: 'b', role: 'current' }] }),
      change({
        title: '人に見せる範囲を広げる',
        evidence: [{ log_id: 'c', role: 'attempt' }, { log_id: 'old', role: 'before' }],
      }),
    ]);
    expect(changes).toHaveLength(2);
  });
});

describe('how many (§20)', () => {
  const ctx = context({
    knownLogIds: new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'old']),
    monthLogIds: new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
  });
  const spread = (...ids: string[]) =>
    ids.map((id, i) => ({ log_id: id, role: i === 0 ? 'attempt' : 'current' }));

  it('publishes five when five stand on their own records', () => {
    // A month is usually several things going in different directions, not
    // one tidy story. Capping at three threw away readings already made.
    const many = [
      change({ title: 'あの方へ動く', evidence: spread('a', 'b') }),
      change({ title: 'いの方へ動く', evidence: spread('c', 'd') }),
      change({ title: 'うの方へ動く', evidence: spread('e', 'f') }),
      change({ title: 'えの方へ動く', evidence: spread('g', 'old') }),
      change({ title: 'おの方へ動く', evidence: spread('a', 'c', 'e') }),
    ];
    expect(read(many, ctx).changes).toHaveLength(5);
  });

  it('stops at five', () => {
    const many = ['あ', 'い', 'う', 'え', 'お', 'か'].map((mark, index) =>
      change({
        title: `${mark}の方へ動く`,
        evidence: spread(['a', 'c', 'e', 'g', 'b', 'd'][index]!, ['b', 'd', 'f', 'old', 'f', 'g'][index]!),
      })
    );
    expect(read(many, ctx).changes.length).toBeLessThanOrEqual(MAX_CHANGES);
  });

  it('returns nothing rather than padding', () => {
    // The ceiling went up; the floor did not. One invented change makes the
    // other four unreadable, because the person cannot tell which was which.
    expect(read([]).changes).toEqual([]);
    expect(read([change({ title: '仕事' })]).changes).toEqual([]);
  });

  it('lets one record be evidence for two different changes', () => {
    // An afternoon can be evidence for more than one thing. Treating any
    // overlap as duplication is how a month collapses to a single point.
    const { changes } = read(
      [
        change({ title: '自分の基準で選ぶ', evidence: spread('a', 'b') }),
        change({ title: '人に希望を伝える', evidence: spread('a', 'c', 'd') }),
      ],
      ctx
    );
    expect(changes).toHaveLength(2);
  });
});

describe('gains (§32, §33)', () => {
  it('drops one that cites no record of the change', () => {
    const { changes } = read([
      change({ gains: [{ category: 'method', label: '結論から伝える', evidence_log_ids: [] }] }),
    ]);
    expect(changes[0]?.gains).toEqual([]);
  });

  it('keeps one standing on the change own records', () => {
    const { changes } = read([
      change({
        gains: [{ category: 'method', label: '結論から伝える', evidence_log_ids: ['a'] }],
      }),
    ]);
    expect(changes[0]?.gains).toEqual([
      { category: 'method', label: '結論から伝える', evidenceLogIds: ['a'] },
    ]);
  });
});
