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
      const known = row.kind === '方向性' ? areas : cards;
      expect(known.has(row.label ?? '') || renamed.has(row.label ?? '')).toBe(true);
    }
  });

  it('is strictly in the order it happened (§17)', () => {
    // Pattern detection reads records in order, so the dates must not go back.
    const dates = logs.map((r) => r.occurred_on ?? '');
    expect([...dates].sort()).toEqual(dates);
  });

  it('has SQL that still matches the spreadsheet', () => {
    const before = read('supabase/demo/demo_data.sql');
    const beforeRemoval = read('supabase/demo/demo_data_remove.sql');
    execFileSync('node', [join(ROOT, 'scripts/build-demo-sql.mjs')], { cwd: ROOT });
    expect(read('supabase/demo/demo_data.sql')).toBe(before);
    expect(read('supabase/demo/demo_data_remove.sql')).toBe(beforeRemoval);
  });

  it('writes evidence and nothing that should be worked out from it', () => {
    const sql = read('supabase/demo/demo_data.sql');
    for (const table of ['progressions', 'progression_evidence', 'gains',
                         'log_ai_analysis', 'month_reviews', 'year_reviews']) {
      expect(sql).not.toContain(`public.${table}`);
    }
  });
});
