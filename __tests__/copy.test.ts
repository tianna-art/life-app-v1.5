import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMERGED_LINE,
  EMPTY_STATE,
  FORBIDDEN_PHRASES,
  HOME,
  JOINED_LINE,
  LABELS,
  MONTH,
  ONBOARDING,
  YEAR,
} from '../src/constants/copy';
import { DIRECTION_AREAS } from '../src/constants/areas';
import { DESIRED_SELF_CARDS } from '../src/constants/desiredSelf';
import { MOMENT_TAGS, LOG_TYPES } from '../src/constants/log';

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
    ...Object.values(ONBOARDING),
    ...Object.values(MONTH),
    ...Object.values(YEAR),
    ...Object.values(EMPTY_STATE),
    ...Object.values(LABELS),
    JOINED_LINE,
    EMERGED_LINE,
    ...DIRECTION_AREAS.map((a) => a.label),
    ...DESIRED_SELF_CARDS.map((c) => c.label),
    ...MOMENT_TAGS.map((t) => t.label),
    ...LOG_TYPES.map((t) => t.label),
  ];

  it('keeps the forbidden register out of every shipped string', () => {
    for (const value of strings) {
      expect(typeof value).toBe('string');
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(value).not.toContain(phrase);
      }
    }
  });

  it('asks about what happened, never about what it meant (§12)', () => {
    const asked = [HOME.level1, HOME.level2, HOME.answerPlaceholder];
    for (const banned of ['なぜ', '学び', '意味', '次は何', 'どうして']) {
      for (const value of asked) expect(value).not.toContain(banned);
    }
  });

  it('never calls the year a target (§1, §5)', () => {
    // §1: the gap is a lens, not a mark. Nothing on these screens may read as
    // something to hit.
    for (const banned of ['目標', '達成', 'ゴール', '未達']) {
      for (const value of Object.values(ONBOARDING)) {
        // The one allowed use is the sentence saying it is *not* a goal.
        if (value === ONBOARDING.themeHint) continue;
        expect(value).not.toContain(banned);
      }
      for (const value of Object.values(MONTH)) expect(value).not.toContain(banned);
      for (const area of DIRECTION_AREAS) expect(area.label).not.toContain(banned);
    }
    // And that one exception says exactly that.
    expect(ONBOARDING.themeHint).toContain('目標ではありません');
  });

  it('says plainly that the free text is optional (§14)', () => {
    expect(HOME.answerPlaceholder).toContain('答えなくても');
  });

  it('ships no streak, point, badge or percentage anywhere in the source', () => {
    // §29: features that must not exist. Comments are stripped first so the
    // list of banned features in this file's own neighbours does not trip it.
    const banned = /\b(streak|badge|leaderboard|followers?Count|pointsEarned|completionRate)\b/i;
    for (const file of SCANNED.flatMap((dir) => walk(join(ROOT, dir)))) {
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect({ file, matched: banned.test(source) }).toEqual({ file, matched: false });
    }
  });


  it('asks the month brief for a hypothesis, never a verdict', () => {
    const prompt = readFileSync(
      join(ROOT, 'supabase/functions/_shared/prompts.ts'),
      'utf8'
    );
    const section = prompt.slice(
      prompt.indexOf('export const MONTH_MAP_SYSTEM'),
      prompt.indexOf('export const YEAR_REVIEW_SYSTEM')
    );
    // The one place the direction explains anything, so it is also the one
    // place most likely to slip into explaining the person.
    expect(section).toContain('断定しない');
    expect(section).toContain('本人を説明しない');
    for (const banned of ['達成率', '進捗']) {
      // Named as forbidden, not used.
      expect(section).toContain(banned);
      expect(section).toContain('書かない');
    }
  });

  it('stores no column that could hold a distance from the target (§1, §19)', () => {
    // The lens must not become a score. A column for "how close are they"
    // would be on a screen within a month of existing, so the migration is
    // checked for one directly.
    const sql = readFileSync(
      join(ROOT, 'supabase/migrations/20260907000100_lens_model.sql'),
      'utf8'
    );
    const lensTable = sql.slice(
      sql.indexOf('create table if not exists public.year_directions'),
      sql.indexOf('create table if not exists public.month_themes')
    );
    for (const banned of ['progress', 'score', 'completion', 'achieved', 'percent']) {
      expect(lensTable.toLowerCase()).not.toContain(`${banned} `);
    }
  });
});
