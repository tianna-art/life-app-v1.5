/**
 * The app and the Edge Functions have to agree about what a reading is allowed
 * to be. There is one original and one generated copy, and this fails the
 * moment they stop matching — which is the moment a card rejected in one place
 * would be accepted in the other.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(__dirname, '..');
const TARGET = join(ROOT, 'supabase/functions/_shared/reading.ts');

describe('the reading rules', () => {
  it('are in step between the app and the functions', () => {
    // The script itself decides what "in step" means, so there is no second
    // description of the transformation here to drift from the first.
    const result = execFileSync('node', ['scripts/sync-shared.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result).toMatch(/up to date/);
  });

  it('say the same thing about the two numbers everything else rests on', () => {
    const copy = readFileSync(TARGET, 'utf8');
    expect(copy).toContain('export const EVIDENCE_FOR_PATTERN = 2;');
    expect(copy).toContain('export const CARDS_FOR_HYPOTHESIS = 2;');
  });

  it('is marked as generated, so nobody edits the copy', () => {
    expect(readFileSync(TARGET, 'utf8')).toMatch(/GENERATED — do not edit/);
  });
});
