import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CATEGORIES, ANTENNAS, ANTENNA_ORDER, MAX_ANTENNAS } from '../src/domain/antennas';

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

  it('files every record under a category the domain has, with one of its details', () => {
    const byLabel = new Map(ALL_CATEGORIES.map((c) => [c.label, c]));
    for (const row of logs) {
      const category = byLabel.get(row.category ?? '');
      expect(category).toBeDefined();
      // A detail only means anything inside its own category. One borrowed
      // from another would load a record the composer could not have made.
      if (row.detail) {
        expect(category?.details.some((d) => d.label === row.detail)).toBe(true);
      }
    }
  });

  it('chooses antennas the domain has, and no more than the ceiling', () => {
    const titles = new Set(ANTENNA_ORDER.map((id) => ANTENNAS[id].title));
    const perMonth = new Map<string, number>();
    for (const row of setup) {
      // The declarations are the person's own sentences, not picks from a
      // list, so there is nothing to look them up against.
      if (row.kind !== 'アンテナ') continue;
      expect(titles.has(row.label ?? '')).toBe(true);
      const month = row.group ?? '';
      perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
    }
    expect(perMonth.size).toBeGreaterThan(0);
    for (const count of perMonth.values()) {
      expect(count).toBeLessThanOrEqual(MAX_ANTENNAS);
    }
  });

  it('files every record under an antenna its month actually chose', () => {
    // Otherwise the composer could never have produced it: it only offers the
    // categories of the month's own antennas.
    const byLabel = new Map(ALL_CATEGORIES.map((c) => [c.label, c]));
    const titles = new Map(ANTENNA_ORDER.map((id) => [ANTENNAS[id].title, id]));
    const chosen = new Map<string, string[]>();
    for (const row of setup) {
      if (row.kind !== 'アンテナ') continue;
      const id = titles.get(row.label ?? '');
      chosen.set(row.group ?? '', [...(chosen.get(row.group ?? '') ?? []), id ?? '']);
    }
    for (const row of logs) {
      const month = (row.occurred_on ?? '').slice(0, 7);
      const antenna = byLabel.get(row.category ?? '')?.antennaId ?? '';
      expect(chosen.get(month) ?? []).toContain(antenna);
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
    execFileSync('npx', ['tsx', join(ROOT, 'scripts/build-demo-sql.ts')], { cwd: ROOT });
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
