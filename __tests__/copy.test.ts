/**
 * Guards on the register.
 *
 * The words come from the preview and are generated, so what needs testing is
 * not their spelling but what they must never contain: diagnosis, rescue, and
 * any measure of how close someone is to a direction.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COPY, FORBIDDEN_PHRASES } from '../src/constants/copy';
import { ANTENNAS, ANTENNA_WISH, FUTURE_TYPES, TYPE_LABEL } from '../src/constants/generated/preview';

const ROOT = join(__dirname, '..');
const SCANNED = ['app', 'components', 'src', 'supabase/functions'];
const SKIP = new Set(['node_modules', '.git', '__tests__', 'generated']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function everyString(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) everyString(v, out);
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) everyString(v, out);
  return out;
}

describe('the app does not diagnose, rescue or count', () => {
  it('keeps the forbidden register out of every shipped string', () => {
    const strings = [
      ...everyString(COPY),
      ...everyString(ANTENNAS),
      ...everyString(ANTENNA_WISH),
      ...everyString(FUTURE_TYPES),
      ...everyString(TYPE_LABEL),
    ];
    expect(strings.length).toBeGreaterThan(200);

    for (const value of strings) {
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(value).not.toContain(phrase);
      }
    }
  });

  it('keeps the forbidden register out of the source as well', () => {
    // A string typed straight into a component bypasses the copy module, so
    // the files are scanned too.
    const offenders: string[] = [];
    for (const dir of SCANNED) {
      let files: string[] = [];
      try {
        files = walk(join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        // A file is allowed to contain a forbidden phrase only by saying so:
        // the guard list, the rules that reject it, and the prompt that tells
        // the model not to write it all have to name it. The marker has to be
        // typed deliberately, which a file drifting into the register will not
        // do by accident.
        if (text.includes('@declares-forbidden-register')) continue;
        for (const phrase of FORBIDDEN_PHRASES) {
          if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// A blunt scan for 達成 was tried here and removed: the preview says
// 「達成するものではありません」 — the word appears inside the very sentence
// that denies it. FORBIDDEN_PHRASES names the measures themselves (達成率,
// 一致率, 進捗, 未達), which is the thing that must not ship.
