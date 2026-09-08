/**
 * Turns the demo spreadsheet (as TSV) into one SQL file the browser can run.
 *
 * The TSVs under supabase/demo/ are the source of truth and are meant to be
 * read in a diff; this script only rewrites them as statements. Every label in
 * them is looked up against the app's own constants, so a renamed card or tag
 * fails here rather than loading a row the app cannot read.
 *
 *   npm run build:demo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_CATEGORIES, ANTENNAS, ANTENNA_ORDER, MAX_ANTENNAS } from '../src/domain/antennas';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** id/label pairs out of a constants file, without importing TypeScript. */
function catalogue(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /id:\s*'([a-z0-9_]+)'\s*,\s*\n?\s*label:\s*'([^']+)'/g;
  for (const [, id, label] of source.matchAll(re)) out.set(label ?? '', id ?? '');
  return out;
}

// The domain is imported, not parsed. Reading ids out of the file with a
// regex is how the two drift: a rename that the parser does not expect turns
// into a silent miss, and the demo loads a vocabulary the app has not got.
const ANTENNA_BY_TITLE = new Map(
  ANTENNA_ORDER.map((id) => [ANTENNAS[id].title, id])
);
const CATEGORY_BY_LABEL = new Map(
  ALL_CATEGORIES.map((category) => [category.label, category])
);

const LABEL_ALIASES = new Map<string, string>();

function lookup(catalog: Map<string, string>, label: string, what: string): string {
  const key = LABEL_ALIASES.get(label) ?? label;
  const id = catalog.get(key);
  if (!id) throw new Error(`${what}「${label}」は constants にありません。`);
  return id;
}

function tsv(path: string): Record<string, string>[] {
  const [head, ...rest] = read(path).trim().split('\n');
  const cols = (head ?? '').split('\t');
  return rest.map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

const lit = (value: string | null | undefined): string => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const array = (ids: readonly string[]): string => `array[${ids.map(lit).join(', ')}]`;

// ---- the lens -------------------------------------------------------------

const setup = tsv('supabase/demo/setup.tsv').filter((r) => r.selected === '1');

/**
 * The month's antennas. At most two, and the ceiling is the domain's.
 *
 * This is the lens. It used to be the year's — ten directions and thirty-one
 * cards, chosen once — and it is the month's now, because a month is the unit
 * of observation.
 */
const monthAntennas = new Map<string, string[]>();
for (const row of setup.filter((r) => r.kind === 'アンテナ')) {
  const id = ANTENNA_BY_TITLE.get(row.label ?? '');
  if (!id) throw new Error(`アンテナ「${row.label}」は domain にありません。`);
  const list = monthAntennas.get(row.group ?? '') ?? [];
  if (list.length >= MAX_ANTENNAS) {
    throw new Error(`${row.group} のアンテナが ${MAX_ANTENNAS} を超えています。`);
  }
  monthAntennas.set(row.group ?? '', [...list, id]);
}

/**
 * The declarations (§5).
 *
 * Not targets and not scored — the spreadsheet's own words for what the person
 * said at the time, so the reading has the first thing §14 looks for. Without
 * a month declaration the demo can only exercise the fallbacks, which is a
 * demo of the wrong thing.
 *
 * `group` holds the period: a year for 年テーマ, `YYYY-MM` for 月テーマ.
 */
const yearThemes = new Map(
  setup.filter((r) => r.kind === '年テーマ').map((r) => [Number(r.group), r.label])
);
for (const year of yearThemes.keys()) {
  if (!Number.isFinite(year)) throw new Error(`年テーマの年が読めません: ${year}`);
}

const monthThemes = setup
  .filter((r) => r.kind === '月テーマ')
  .map((r) => ({
    year: Number((r.group ?? '').slice(0, 4)),
    month: Number((r.group ?? '').slice(5, 7)),
    theme: r.label ?? '',
  }));

// ---- the records ----------------------------------------------------------

const logs = tsv('supabase/demo/logs.tsv').map((row, index) => {
  const category = CATEGORY_BY_LABEL.get(row.category ?? '');
  if (!category) throw new Error(`カテゴリ「${row.category}」は domain にありません。`);
  // A detail only means anything inside its category, so it is looked up
  // there: 「人」 is a source of influence under ときめき and someone you were
  // with under 活かし方.
  const detail = row.detail
    ? category.details.find((d) => d.label === row.detail)
    : null;
  if (row.detail && !detail) {
    throw new Error(`「${row.category}」に詳細「${row.detail}」はありません。`);
  }
  return {
    key: row.log_id ?? '',
    occurredOn: row.occurred_on ?? '',
    categoryId: category.id as string,
    detailId: detail?.id ?? null,
    text: row.text ?? '',
    index,
  };
});

// Every demo record is filed under an antenna the month actually chose.
// Otherwise the composer could never have produced it.
for (const log of logs) {
  const month = log.occurredOn.slice(0, 7);
  const chosen = monthAntennas.get(month) ?? [];
  const antenna = ALL_CATEGORIES.find((c) => c.id === log.categoryId)?.antennaId;
  if (!antenna || !chosen.includes(antenna)) {
    throw new Error(`${log.key}: ${month} のアンテナに ${antenna} がありません。`);
  }
}

// Records are read strictly in the order they happened (§17), so two records
// on the same day must not tie. The minute comes from the row's position,
// which is the only ordering the spreadsheet actually asserts.
const occurredAt = (log: { occurredOn: string; index: number }): string => {
  const minute = String(log.index % 60).padStart(2, '0');
  return `${log.occurredOn}T21:${minute}:00+09:00`;
};

const years = [...new Set(logs.map((l) => Number(l.occurredOn.slice(0, 4))))].sort();

const values = logs
  .map(
    (log) =>
      `    (${lit(log.key)}, ${lit(log.occurredOn)}, ${lit(occurredAt(log))}, ` +
      `${lit(log.categoryId)}, ${lit(log.detailId)}, ${lit(log.text)})`
  )
  .join(',\n');

const sql = `-- crincran — demo data.
--
-- Generated by scripts/build-demo-sql.ts from supabase/demo/*.tsv. Edit the
-- TSVs and re-run; do not edit this file.
--
-- ${logs.length} records, ${years[0]} to ${years[years.length - 1]}, plus the lens and the declarations they were
-- recorded under. Nothing else: no analysis, no progressions, no month
-- readings. Those are what the app produces from evidence, and writing them
-- here would be inventing the very thing the demo is meant to show it finding.
--
-- Row ids are derived from the account's own id, so loading twice replaces the
-- same ${logs.length} rows instead of doubling them, and demo rows can never collide
-- with real ones.
--
-- __DEMO_EMAIL__ is replaced by .github/workflows/load-demo-data.yml.

do $$
declare
  uid uuid;
  demo record;
  inserted integer := 0;
begin
  select id into uid from auth.users where lower(email) = lower('__DEMO_EMAIL__');
  if uid is null then
    raise exception 'このメールアドレスのアカウントが見つかりません: %', '__DEMO_EMAIL__';
  end if;

  -- The year's declaration. One row per year the records span; it is a
  -- heading, not a target, and the year-end reading compares against it.
  insert into public.year_directions (user_id, year, initial_theme)
  select uid, y, t.theme
    from unnest(
      array[${years.join(', ')}],
      array[${years.map((y) => lit(yearThemes.get(y) ?? null)).join(', ')}]::text[]
    ) as t(y, theme)
  -- Never over a declaration the person made. The theme the demo writes is
  -- its own, which is also why the update below cannot reach theirs.
  on conflict (user_id, year) do update
     set initial_theme = excluded.initial_theme
   where public.year_directions.initial_theme is null;

  -- The month's declaration and its antennas. The antennas are the lens: at
  -- most two, chosen at the start of the month, and what the composer offers
  -- categories from. Source is custom because the person wrote the theme
  -- rather than taking one of the three the model offered — there was no
  -- month before it to base a candidate on.
  insert into public.month_themes
    (user_id, year, month, initial_theme, source, antenna_ids)
  select uid, m.year, m.month, m.theme, 'custom', m.antennas
    from (values
${monthThemes
  .map(
    (m) =>
      `      (${m.year}, ${m.month}, ${lit(m.theme)}, ` +
      `${array(monthAntennas.get(`${m.year}-${String(m.month).padStart(2, '0')}`) ?? [])})`
  )
  .join(',\n')}
    ) as m(year, month, theme, antennas)
  on conflict (user_id, year, month) do update
     set initial_theme = excluded.initial_theme,
         source = excluded.source,
         antenna_ids = excluded.antenna_ids
   where public.month_themes.initial_theme is null
     and public.month_themes.final_theme is null;

  for demo in
    select * from (values
${values}
    ) as t(key, occurred_on, occurred_at, category_id, detail_id, body)
  loop
    insert into public.logs
      (id, user_id, occurred_on, occurred_at, category_id, detail_id, body,
       input_method, classification_source, classification_status)
    values (
      md5(uid::text || ':crincran-demo:' || demo.key)::uuid,
      uid,
      demo.occurred_on::date,
      demo.occurred_at::timestamptz,
      demo.category_id,
      demo.detail_id,
      demo.body,
      'category'::public.log_input_method,
      'user'::public.classification_source,
      'confirmed'::public.classification_status
    )
    on conflict (id) do update
       set occurred_on = excluded.occurred_on,
           occurred_at = excluded.occurred_at,
           category_id = excluded.category_id,
           detail_id = excluded.detail_id,
           body = excluded.body;
    inserted := inserted + 1;
  end loop;

  raise notice 'crincran demo: % records for %', inserted, '__DEMO_EMAIL__';
end $$;
`;

writeFileSync(join(ROOT, 'supabase/demo/demo_data.sql'), sql);

// Loading demo data into a real account has to be undoable, and by exactly as
// much as it added: these are the same derived ids, so nothing the person
// wrote themselves can be caught by it.
const removal = `-- crincran — remove the demo data.
--
-- Generated by scripts/build-demo-sql.ts. Deletes the ${logs.length} demo records and
-- the years' lens rows, and nothing else: the ids are derived the same way
-- they were written, so a record the person made themselves cannot match.

do $$
declare
  uid uuid;
  removed integer;
begin
  select id into uid from auth.users where lower(email) = lower('__DEMO_EMAIL__');
  if uid is null then
    raise exception 'このメールアドレスのアカウントが見つかりません: %', '__DEMO_EMAIL__';
  end if;

  delete from public.logs
   where user_id = uid
     and id in (
       select md5(uid::text || ':crincran-demo:' || key)::uuid
         from unnest(array[${logs.map((l) => lit(l.key)).join(', ')}]) as key
     );
  get diagnostics removed = row_count;

  -- Only the rows the demo itself wrote. A theme the demo did not write, a
  -- final theme, or a lens means the row is the person's own, and it stays.
  delete from public.month_themes
   where user_id = uid
     and (year, month) in (${monthThemes.map((m) => `(${m.year}, ${m.month})`).join(', ')})
     and final_theme is null
     and initial_theme in (${monthThemes.map((m) => lit(m.theme)).join(', ')});

  delete from public.year_directions
   where user_id = uid
     and year = any(array[${years.join(', ')}])
     and (initial_theme is null
          or initial_theme in (${[...yearThemes.values()].map(lit).join(', ')}))
     and final_theme is null;

  raise notice 'crincran demo: removed % records for %', removed, '__DEMO_EMAIL__';
end $$;
`;

writeFileSync(join(ROOT, 'supabase/demo/demo_data_remove.sql'), removal);

// The other direction: keep the demo, take out everything else.
//
// An account can hold records that arrived some other way, and the demo is
// only a demo if what surrounds it is known. Written from the same id list as
// the removal, so "not the demo" here means exactly the rows that file spares.
const purge = `-- crincran — remove everything in an account EXCEPT the demo records.
--
-- Generated by scripts/build-demo-sql.ts.
--
-- DESTRUCTIVE and not undoable: this deletes records the person wrote. Run it
-- only on an account meant to hold nothing but the demo.
--
-- What goes: every log that is not one of the ${logs.length} demo rows, everything that
-- hangs off those logs (analysis, evidence links — all cascade), any
-- progression left with no evidence behind it, and the month and year
-- readings. Those readings described a set of records that no longer exists,
-- and a reading nothing supports is worse than no reading.
--
-- What stays: the ${logs.length} demo records, the year's direction, and the month
-- themes — choices the person made, rather than things worked out from
-- evidence.

do $$
declare
  uid uuid;
  demo uuid[];
  removed_logs integer;
  removed_progressions integer;
begin
  select id into uid from auth.users where lower(email) = lower('__DEMO_EMAIL__');
  if uid is null then
    raise exception 'このメールアドレスのアカウントが見つかりません: %', '__DEMO_EMAIL__';
  end if;

  select array_agg(md5(uid::text || ':crincran-demo:' || key)::uuid)
    into demo
    from unnest(array[${logs.map((l) => lit(l.key)).join(', ')}]) as key;

  delete from public.logs
   where user_id = uid
     and not (id = any(demo));
  get diagnostics removed_logs = row_count;

  -- The evidence rows went with the logs. A progression with none left is not
  -- a progression any more: a trail is its points.
  delete from public.progressions p
   where p.user_id = uid
     and not exists (
       select 1 from public.progression_evidence e where e.progression_id = p.id
     );
  get diagnostics removed_progressions = row_count;

  -- A change stands on records. When the records it cited are gone, so is
  -- the argument for it, and a card quoting nothing is worse than no card.
  delete from public.changes c
   where c.user_id = uid
     and not exists (
       select 1 from public.change_evidence e where e.change_id = c.id
     );

  delete from public.month_reviews where user_id = uid;
  delete from public.year_reviews where user_id = uid;

  raise notice 'crincran purge: % logs, % progressions removed for %',
    removed_logs, removed_progressions, '__DEMO_EMAIL__';
end $$;
`;

writeFileSync(join(ROOT, 'supabase/demo/purge_others.sql'), purge);

console.log(
  `supabase/demo/demo_data.sql — ${logs.length} records, ` +
    `${[...monthAntennas.values()].flat().length} antenna choices, years ${years.join('/')}`
);
