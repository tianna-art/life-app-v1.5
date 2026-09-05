import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_STATE, FORBIDDEN_PHRASES, HOME, LABELS, UNRESOLVED_LINE } from '../src/constants/copy';

const ROOT = join(__dirname, '..');
const SCANNED = ['app', 'components', 'src', 'supabase/functions'];
const SKIP = new Set(['node_modules', '.git', '__tests__']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('the app does not praise, diagnose or count', () => {
  const strings = [
    ...Object.values(HOME),
    ...Object.values(EMPTY_STATE),
    ...Object.values(LABELS),
    UNRESOLVED_LINE,
  ];

  it('keeps the forbidden register out of every pinned string', () => {
    for (const value of strings) {
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(value).not.toContain(phrase);
      }
    }
  });

  it('asks about what happened, never about what it meant', () => {
    // §5: the questions the app is forbidden to ask.
    for (const banned of ['なぜ', '学び', '意味', '次は何']) {
      expect(HOME.question).not.toContain(banned);
      expect(HOME.placeholder).not.toContain(banned);
    }
  });

  it('ships no streak, point, badge or percentage anywhere in the source', () => {
    // §24: features that must not exist. Comments are stripped first so the
    // list of banned features in this file's own neighbours does not trip it.
    const banned = /\b(streak|badge|leaderboard|followers?Count|pointsEarned)\b/i;
    for (const file of SCANNED.flatMap((dir) => walk(join(ROOT, dir)))) {
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect({ file, matched: banned.test(source) }).toEqual({ file, matched: false });
    }
  });
});
