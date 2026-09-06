import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const MIGRATIONS = join(ROOT, 'supabase/migrations');
const FUNCTIONS = join(ROOT, 'supabase/functions');

/**
 * Which columns a row must carry, worked out from the migrations.
 *
 * NOT NULL with no default and no generated value: the writer has to supply it
 * or the insert fails at the database. `id`, `created_at` and the rest usually
 * have defaults and drop out of this on their own.
 */
function requiredColumns(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    const created = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
    for (const match of sql.matchAll(created)) {
      const name = match[1]!;
      const required = tables.get(name) ?? new Set<string>();
      for (const rawLine of match[2]!.split('\n')) {
        const line = rawLine.replace(/--.*$/, '').trim().replace(/,$/, '');
        const column = /^([a-z_]+)\s+/.exec(line)?.[1];
        if (!column || /^(constraint|unique|primary|check|foreign)$/.test(column)) continue;
        if (!/\bnot null\b/i.test(line) || /\bdefault\b/i.test(line)) continue;
        required.add(column);
      }
      tables.set(name, required);
    }

    // A column added later, and a constraint dropped later, both count.
    for (const match of sql.matchAll(
      /alter table public\.(\w+) add column if not exists ([a-z_]+)([^;]*);/g
    )) {
      const clause = match[3]!;
      if (!/\bnot null\b/i.test(clause) || /\bdefault\b/i.test(clause)) continue;
      const required = tables.get(match[1]!) ?? new Set<string>();
      required.add(match[2]!);
      tables.set(match[1]!, required);
    }
    for (const match of sql.matchAll(
      /alter table public\.(\w+) alter column ([a-z_]+) drop not null/g
    )) {
      tables.get(match[1]!)?.delete(match[2]!);
    }
  }

  return tables;
}

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/** The text between a bracket and its partner, starting at the bracket. */
function balanced(source: string, open: number): string {
  const close = PAIRS[source[open] ?? ''];
  if (!close) return '';
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === source[open]) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

/** The first argument of a call, up to the top-level comma. */
function firstArgument(args: string): string {
  let depth = 0;
  for (let i = 0; i < args.length; i += 1) {
    const c = args[i]!;
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) return args.slice(0, i);
  }
  return args;
}

/**
 * The initialiser of `const <name> = ...`, to the end of its statement.
 *
 * To the statement's own semicolon rather than to the first bracket group: the
 * row is often built by a chain (`ids.filter(...).map(...)`), and stopping at
 * the first bracket reads the filter's predicate and finds no columns at all.
 */
function initialiserOf(source: string, name: string): string | null {
  const declared = new RegExp(`const ${name}\\b[^=;]*=`).exec(source);
  if (!declared) return null;
  const start = declared.index + declared[0].length;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i]!;
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ';' && depth === 0) return source.slice(start, i);
  }
  return source.slice(start);
}

/** Comments carry commas and words and would be read as keys. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The keys of an object literal, explicit and shorthand alike.
 *
 * `year,` sets `year` exactly as `year: year` does, and a check that could not
 * see the shorthand would report a column as missing that is right there.
 */
function keysOf(body: string): Set<string> {
  const keys = new Set<string>();
  for (const m of body.matchAll(/(?:^|[\s{,])([a-z_]+)\s*:/g)) keys.add(m[1]!);
  for (const m of body.matchAll(/[{,]\s*([a-z_]+)\s*(?=[,}])/g)) keys.add(m[1]!);
  return keys;
}

/**
 * Every insert an Edge Function makes, with the columns it sets.
 *
 * An insert whose argument is a name rather than a literal is followed to
 * where that name is built. That is not a nicety: the write that actually
 * failed was `.insert(gains)`, and a check that gave up on the indirection
 * would have passed it.
 */
function inserts(source: string): Array<{ table: string; keys: Set<string> }> {
  const out: Array<{ table: string; keys: Set<string> }> = [];
  const pattern = /\.from\('(\w+)'\)\s*\n?\s*\.(?:insert|upsert)\(/g;

  for (const match of source.matchAll(pattern)) {
    // The row is the first argument; the second is options like onConflict,
    // whose keys are not columns.
    let body = firstArgument(balanced(source, match.index! + match[0].length - 1));

    const named = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(body)?.[1];
    if (named) {
      // Unresolvable: say so by treating it as opaque rather than as empty,
      // which would report every required column as missing.
      body = initialiserOf(source, named) ?? '...';
    }

    const keys = keysOf(stripComments(body));
    // A spread means part of the object is assembled somewhere this cannot
    // see, so the row is left to the reviewer rather than guessed at.
    if (body.includes('...')) keys.add('*');
    out.push({ table: match[1]!, keys });
  }
  return out;
}

/**
 * A column the table requires and the writer never sets.
 *
 * This has cost a run. `gains.type` was the v2 vocabulary `category` replaced —
 * nothing reads it, and it stayed NOT NULL with no default. One writer knew and
 * filled it with a meaningless value; the next did not, and its insert failed
 * at the database. The month published one change, then threw, and the brief
 * written last never existed. From outside that reads as a thin month, not as
 * a broken write.
 *
 * The prompt cannot catch this and neither can the type-checker: the row is an
 * untyped object literal on its way to Postgres. So it is checked here, from
 * the schema the migrations actually build.
 */
describe('what a row must carry', () => {
  const required = requiredColumns();

  const files: string[] = [];
  for (const entry of readdirSync(FUNCTIONS, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_shared') continue;
    files.push(join(FUNCTIONS, entry.name, 'index.ts'));
  }
  files.push(join(FUNCTIONS, '_shared/progressionStore.ts'));

  it.each(files.map((f) => [f.replace(`${ROOT}/`, ''), f]))(
    '%s sets every column its tables require',
    (_name, file) => {
      const missing: string[] = [];
      for (const { table, keys } of inserts(readFileSync(file, 'utf8'))) {
        if (keys.has('*')) continue;
        for (const column of required.get(table) ?? []) {
          if (!keys.has(column)) missing.push(`${table}.${column}`);
        }
      }
      expect(missing).toEqual([]);
    }
  );

  it('catches the write that cost a run', () => {
    // The real one, reconstructed: gains.type was NOT NULL with no default,
    // and this insert does not set it. A check that only ever passes on the
    // current tree proves nothing, so the failing case is kept here.
    const before = new Map(requiredColumns());
    before.set('gains', new Set([...(before.get('gains') ?? []), 'type']));

    const write = `
      const { error } = await db.from('gains').insert({
        user_id: user.id,
        change_id: changeId,
        category,
        label: gain.label,
        confidence: 0.5,
      });
    `;
    const missing: string[] = [];
    for (const { table, keys } of inserts(write)) {
      for (const column of before.get(table) ?? []) {
        if (!keys.has(column)) missing.push(`${table}.${column}`);
      }
    }
    expect(missing).toEqual(['gains.type']);
  });

  it('reads the schema it is checking against', () => {
    // A parser that quietly found nothing would pass every test above.
    expect(required.get('logs')?.has('user_id')).toBe(true);
    expect(required.get('progressions')?.has('title')).toBe(true);
    expect(required.get('changes')?.has('title')).toBe(true);
    // Dropped in 20260912, and the drop has to be seen.
    expect(required.get('gains')?.has('type')).toBe(false);
  });
});
