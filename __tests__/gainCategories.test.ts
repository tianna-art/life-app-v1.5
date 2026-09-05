import {
  GAIN_CATEGORIES,
  isGainCategory,
  resolveGainCategory,
} from '../src/ai/progressionRules';
import { GAIN_CATEGORY_JA, GAIN_CATEGORY_LABEL } from '../src/constants/progression';

/**
 * Progression is how someone walked; Gain is what the walking left them
 * holding. The seven that came before mixed the two.
 */
describe('the six kinds of gain', () => {
  it('is the six, and confidence is not among them (§20)', () => {
    expect([...GAIN_CATEGORIES].sort()).toEqual([
      'connection',
      'criterion',
      'evidence',
      'insight',
      'method',
      'option',
    ]);
    expect(GAIN_CATEGORIES).not.toContain('confidence');
  });

  it('describes nothing about how the person walked', () => {
    // "できるようになった" and "立て直した" are the walking, not what is left.
    for (const retired of ['capability', 'recovery', 'clarity', 'choice']) {
      expect(isGainCategory(retired)).toBe(false);
    }
  });

  it('still reads a gain written under the old seven', () => {
    // The rows moved by migration, but a cached reading can still arrive.
    expect(resolveGainCategory('clarity')).toBe('insight');
    expect(resolveGainCategory('capability')).toBe('evidence');
    expect(resolveGainCategory('choice')).toBe('criterion');
    expect(resolveGainCategory('recovery')).toBe('evidence');
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
