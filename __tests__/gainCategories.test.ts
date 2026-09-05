import {
  GAIN_CATEGORIES,
  isGainCategory,
  resolveGainCategory,
} from '../src/ai/progressionRules';
import { GAIN_CATEGORY_JA, GAIN_CATEGORY_LABEL } from '../src/constants/progression';

/**
 * §32's seven, restored.
 *
 * They were briefly six: `capability` and `recovery` were folded into
 * `evidence` on the reading that both describe how someone walked rather than
 * what the walking left. The spec keeps them apart, and it is right to —
 * "できるようになった" and "止まったあと、また動いた" are different things to be
 * handed, and telling someone the second is just evidence of the first loses
 * the part that was hard.
 */
describe('the seven kinds of gain', () => {
  it('is the seven, and confidence is not among them (§20)', () => {
    expect([...GAIN_CATEGORIES].sort()).toEqual([
      'capability',
      'choice',
      'clarity',
      'connection',
      'evidence',
      'method',
      'recovery',
    ]);
    // §20: confidence is what a person feels after seeing the evidence, not a
    // thing the app can hand them.
    expect(GAIN_CATEGORIES).not.toContain('confidence');
  });

  it('still reads a gain written under the six', () => {
    // The names are gone from the app but rows and cached readings carry them.
    // Dropping one would silently lose a gain the person was shown once.
    expect(resolveGainCategory('insight')).toBe('clarity');
    expect(resolveGainCategory('criterion')).toBe('choice');
    expect(resolveGainCategory('option')).toBe('clarity');
    expect(isGainCategory('insight')).toBe(false);
  });

  it('refuses a category it has never heard of rather than guessing', () => {
    // Guessing would put a word in the person's mouth about what they have.
    expect(resolveGainCategory('confidence')).toBeUndefined();
    expect(resolveGainCategory(null)).toBeUndefined();
  });

  it('names every one of them, in both languages', () => {
    for (const category of GAIN_CATEGORIES) {
      expect(GAIN_CATEGORY_JA[category]).toBeTruthy();
      expect(GAIN_CATEGORY_LABEL[category]).toBe(category.toUpperCase());
    }
  });
});
