import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EVIDENCE_ROLES,
  GAIN_CATEGORIES,
  JOURNEY_ROLES,
  LOG_TYPES,
  MATURITY_ORDER,
  MOMENT_TAGS,
  PROGRESSION_PATTERNS,
  PROGRESSION_TYPES,
} from '@/ai/progressionRules';

const MIGRATIONS = join(__dirname, '../supabase/migrations');

/**
 * Read the enum values the database will actually have, from the migrations
 * that build it.
 *
 * The files are applied in name order, so replaying them in that order gives
 * the same set the live type ends up with: `create type ... as enum` opens it,
 * and every `alter type ... add value` after that widens it.
 */
function enumsFromMigrations(): Record<string, string[]> {
  const enums: Record<string, string[]> = {};
  const add = (name: string, value: string) => {
    enums[name] ??= [];
    if (!enums[name].includes(value)) enums[name].push(value);
  };

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    const created = /create\s+type\s+public\.(\w+)\s+as\s+enum\s*\(([^)]*)\)/gis;
    for (const match of sql.matchAll(created)) {
      for (const value of match[2]!.matchAll(/'([^']+)'/g)) add(match[1]!, value[1]!);
    }

    const widened = /alter\s+type\s+public\.(\w+)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']+)'/gis;
    for (const match of sql.matchAll(widened)) add(match[1]!, match[2]!);
  }

  return enums;
}

/**
 * What the app is willing to send, and what the column is willing to take.
 *
 * A value the app can produce and the column cannot store is a write that
 * fails at the database, one record at a time, for one particular reading —
 * which is the hardest kind of failure to see. It cost exactly that: §7
 * renamed a setback to a friction across the prompt, the type and the guard,
 * the rename reached progression_evidence_role and never reached journey_role,
 * and five records in a twenty-record month simply never stored.
 *
 * The direction is one-way on purpose. The database keeping a value the app no
 * longer writes is how history stays readable — 'setback' still means what it
 * meant in v3. The app holding one the database refuses is a bug every time.
 */
describe('enum parity', () => {
  const enums = enumsFromMigrations();

  const pairs: Array<[string, readonly string[]]> = [
    ['log_type', LOG_TYPES],
    ['moment_tag', MOMENT_TAGS],
    ['progression_pattern', PROGRESSION_PATTERNS],
    ['progression_type', PROGRESSION_TYPES],
    ['progression_maturity', MATURITY_ORDER],
    ['progression_evidence_role', EVIDENCE_ROLES],
    ['journey_role', JOURNEY_ROLES],
    ['gain_category', GAIN_CATEGORIES],
  ];

  it.each(pairs)('public.%s accepts everything the app writes', (name, values) => {
    const inDatabase = enums[name];
    expect(inDatabase).toBeDefined();
    expect(values.filter((value) => !inDatabase!.includes(value))).toEqual([]);
  });
});
