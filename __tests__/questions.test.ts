import {
  FORBIDDEN_QUESTION_PHRASES,
  MAX_QUESTION_LENGTH,
  QUESTION_RULES,
  isUsableQuestion,
  pickQuestion,
} from '../src/constants/questions';
import { MOMENT_TAGS } from '../src/constants/log';

describe('the Level 3 question (§12)', () => {
  it('asks about facts, never about meaning', () => {
    for (const rule of QUESTION_RULES) {
      for (const question of Object.values(rule.byLogType)) {
        for (const phrase of FORBIDDEN_QUESTION_PHRASES) {
          expect(question).not.toContain(phrase);
        }
      }
    }
  });

  it('stays short enough to answer in one breath', () => {
    for (const rule of QUESTION_RULES) {
      for (const question of Object.values(rule.byLogType)) {
        expect(question.length).toBeLessThanOrEqual(MAX_QUESTION_LENGTH);
      }
    }
  });

  it('rejects the reflective questions the app took off the plate', () => {
    expect(isUsableQuestion('この経験からあなたは何を学びましたか？')).toBe(false);
    expect(isUsableQuestion('なぜそのように感じたのでしょう？')).toBe(false);
    expect(isUsableQuestion('この経験はあなたの人生にどんな意味がありますか？')).toBe(false);
  });

  it('accepts the ones that collect evidence', () => {
    expect(isUsableQuestion('前と何を変えてみた？')).toBe(true);
    expect(isUsableQuestion('誰に見せてみた？')).toBe(true);
  });

  it('rejects a question too long to be one tap of work', () => {
    expect(isUsableQuestion('あ'.repeat(MAX_QUESTION_LENGTH + 1))).toBe(false);
  });

  it('has a question for every tag and every door (§15)', () => {
    // The same tag means something different depending on the door, so every
    // combination has to have somewhere to go.
    expect(QUESTION_RULES).toHaveLength(MOMENT_TAGS.length);
    for (const rule of QUESTION_RULES) {
      expect(Object.keys(rule.byLogType).sort()).toEqual([
        'relationship',
        'self_action',
        'thought',
      ]);
    }
  });
});

describe('pickQuestion', () => {
  it('asks nothing when nothing was tapped', () => {
    expect(pickQuestion({ logType: 'self_action', momentTags: [] })).toBeNull();
  });

  it('asks differently for the same tag through a different door (§15)', () => {
    const alone = pickQuestion({ logType: 'self_action', momentTags: ['changed'] });
    const withSomeone = pickQuestion({ logType: 'relationship', momentTags: ['changed'] });
    expect(alone).toBe('前と何を変えた？');
    expect(withSomeone).toBe('前回と違ったのは？');
  });

  it('prefers the question feeding a pattern the year is watching (§13)', () => {
    // Both tags apply. The one that feeds `expose` wins when that is watched.
    const watched = pickQuestion({
      logType: 'relationship',
      momentTags: ['enjoyed', 'tried'],
      watched: ['expose'],
    });
    expect(watched).toBe('誰に見せてみた？');

    const unwatched = pickQuestion({
      logType: 'relationship',
      momentTags: ['enjoyed', 'tried'],
      watched: ['boundary'],
    });
    // With nothing to break the tie, the more concrete question is asked.
    expect(unwatched).toBe('誰に見せてみた？');
  });

  it('always returns something once a tag exists', () => {
    for (const tag of MOMENT_TAGS) {
      for (const logType of ['self_action', 'relationship', 'thought'] as const) {
        expect(pickQuestion({ logType, momentTags: [tag.id] })).toBeTruthy();
      }
    }
  });
});
