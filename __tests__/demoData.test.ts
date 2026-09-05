import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOG_TYPES, MOMENT_TAGS } from '../src/constants/log';
import { DIRECTION_AREAS } from '../src/constants/areas';
import { DESIRED_SELF_CARDS } from '../src/constants/desiredSelf';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function tsv(path: string): Record<string, string>[] {
  const [head, ...rest] = read(path).trim().split('\n');
  const cols = (head ?? '').split('\t');
  return rest.map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

/**
 * The demo data is loaded straight into a live account, so the two things that
 * would go wrong quietly are checked here: a label the app no longer has, and
 * a generated file that no longer matches the spreadsheet it came from.
 */
describe('demo data', () => {
  const setup = tsv('supabase/demo/setup.tsv');
  const logs = tsv('supabase/demo/logs.tsv');

  it('carries the whole spreadsheet', () => {
    // Not a fixed number: the spreadsheet gets replaced. What has to hold is
    // that the SQL was built from exactly these rows.
    expect(logs.length).toBeGreaterThan(0);
    expect(setup.filter((r) => r.selected === '1').length).toBeGreaterThan(0);

    const stated = /-- (\d+) records,/.exec(read('supabase/demo/demo_data.sql'))?.[1];
    expect(Number(stated)).toBe(logs.length);
  });

  it('uses only categories and tags the app knows', () => {
    const types = new Set(LOG_TYPES.map((t) => t.label));
    const tags = new Set(MOMENT_TAGS.map((t) => t.label));
    for (const row of logs) {
      expect(types.has(row.level1 ?? '')).toBe(true);
      const parts = (row.moment_tags ?? '').split('・').filter(Boolean);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) expect(tags.has(part)).toBe(true);
    }
  });

  it('uses only areas and cards the app knows', () => {
    // One card was renamed after the spreadsheet was written. The alias lives
    // in the generator; this is the list of labels allowed to miss.
    const renamed = new Set(['力が出る環境が分かる']);
    const areas = new Set(DIRECTION_AREAS.map((a) => a.label));
    const cards = new Set(DESIRED_SELF_CARDS.map((c) => c.label));
    for (const row of setup) {
      // The declarations are the person's own sentences, not picks from a
      // list, so there is nothing to look them up against.
      if (row.kind === '年テーマ' || row.kind === '月テーマ') continue;
      const known = row.kind === '方向性' ? areas : cards;
      expect(known.has(row.label ?? '') || renamed.has(row.label ?? '')).toBe(true);
    }
  });

  it('declares a year and a month, and writes both (§5, §14)', () => {
    // §14 looks for the month's declaration first. A demo without one can only
    // exercise the fallbacks, which demonstrates the wrong thing — and the
    // reading would attach every change to a desired-self card by default.
    const yearTheme = setup.find((r) => r.kind === '年テーマ');
    const monthTheme = setup.find((r) => r.kind === '月テーマ');
    expect(yearTheme?.label).toBeTruthy();
    expect(monthTheme?.label).toBeTruthy();
    expect(monthTheme?.group).toMatch(/^\d{4}-\d{2}$/);

    const sql = read('supabase/demo/demo_data.sql');
    expect(sql).toContain('insert into public.month_themes');
    expect(sql).toContain(monthTheme?.label ?? '');
    expect(sql).toContain(yearTheme?.label ?? '');

    // Neither is a target, so neither may arrive as a final theme: that is
    // written at the end of the period, next to what actually happened (§38).
    expect(sql).not.toContain('final_theme = ');
  });

  it('never writes a declaration over one the person made (§5)', () => {
    const sql = read('supabase/demo/demo_data.sql');
    const months = sql.slice(sql.indexOf('insert into public.month_themes'));
    expect(months).toContain('where public.month_themes.initial_theme is null');
    expect(months).toContain('and public.month_themes.final_theme is null');

    // And removing the demo takes back only the sentence the demo wrote.
    const removal = read('supabase/demo/demo_data_remove.sql');
    expect(removal).toContain('delete from public.month_themes');
    expect(removal).toContain(setup.find((r) => r.kind === '月テーマ')?.label ?? '');
  });

  it('is strictly in the order it happened (§17)', () => {
    // Pattern detection reads records in order, so the dates must not go back.
    const dates = logs.map((r) => r.occurred_on ?? '');
    expect([...dates].sort()).toEqual(dates);
  });

  it('has SQL that still matches the spreadsheet', () => {
    const generated = [
      'supabase/demo/demo_data.sql',
      'supabase/demo/demo_data_remove.sql',
      'supabase/demo/purge_others.sql',
    ];
    const before = generated.map(read);
    execFileSync('node', [join(ROOT, 'scripts/build-demo-sql.mjs')], { cwd: ROOT });
    expect(generated.map(read)).toEqual(before);
  });

  it('purges around the demo, never through it', () => {
    const purge = read('supabase/demo/purge_others.sql');

    // The one line that decides what survives.
    expect(purge).toContain('and not (id = any(demo))');
    // Scoped to the account, always.
    expect(purge).toContain('where user_id = uid');
    // The lens and the month themes are the person's own choices, not
    // readings, so nothing derived-data cleanup may take them.
    expect(purge).not.toContain('delete from public.year_directions');
    expect(purge).not.toContain('delete from public.month_themes');
    // Every demo id it is meant to spare is named in it.
    for (const row of logs) expect(purge).toContain(`'${row.log_id}'`);
  });

  it('writes evidence and nothing that should be worked out from it', () => {
    const sql = read('supabase/demo/demo_data.sql');
    // A declaration is evidence — the person said it at the time. A change is
    // not: it is what the reading makes of the records, and shipping one in a
    // fixture would make a broken pipeline look like a working one.
    for (const table of ['progressions', 'progression_evidence', 'gains',
                         'log_ai_analysis', 'changes', 'change_evidence',
                         'month_reviews', 'year_reviews', 'month_maps']) {
      expect(sql).not.toContain(`public.${table}`);
    }
  });
});
