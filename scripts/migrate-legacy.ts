/**
 * One-off importer for data from the previous single-file crincran
 * (life-app v1.5, localStorage key `crincran.v1`).
 *
 * Usage
 *   1. Open the old app, Settings → export. You get `crincran-YYYY-MM-DD.json`.
 *   2. SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_EMAIL=you@example.com \
 *      npx tsx scripts/migrate-legacy.ts ./crincran-2026-09-04.json
 *
 * The mapping is lossy on purpose — the old model had no 出来事 / つぶやき
 * distinction and no editable categories. Everything this script cannot place
 * is written to `<input>.unmapped.json` rather than dropped or invented.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CATEGORIES } from '../src/constants/categories';

interface LegacyLog {
  id?: string;
  kind?: string;
  body?: string;
  occurred_at?: string;
  place?: string;
  people?: string[];
  tags?: string[];
  demo?: number;
}
interface LegacyExport {
  logs?: LegacyLog[];
  months?: Record<string, { title?: string; chapter?: string; tone?: string; angle?: string }>;
  years?: Record<string, { title?: string }>;
  futures?: Array<{ id?: string; body?: string; mode?: string; due?: string | null }>;
}

/**
 * Legacy entry point → new category. The old app's three entry points were
 * 好きなこと / キャリア / つぶやき (plus two retired ones it already aliased).
 */
const KIND_TO_CATEGORY: Record<string, string> = {
  moved: 'tokimeki', // 好きなこと
  wish: 'tokimeki', // retired alias in the old app
  effort: 'tsumiage', // キャリア
  chose: 'tsumiage', // retired alias in the old app
  hard: 'sonota', // つぶやき — an entry point, not a subject
};

/** The old model recorded no type, so it is inferred from the entry point. */
const KIND_TO_TYPE: Record<string, 'event' | 'thought'> = {
  moved: 'event',
  wish: 'event',
  effort: 'event',
  chose: 'event',
  hard: 'thought',
};

const inputPath = process.argv[2];
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL;

if (!inputPath) {
  console.error('Usage: npx tsx scripts/migrate-legacy.ts <crincran-export.json>');
  process.exit(1);
}
if (!url || !serviceRoleKey || !email) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_EMAIL are required.');
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function lastDayOf(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  return `${ym}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const legacy = JSON.parse(readFileSync(inputPath!, 'utf8')) as LegacyExport;

  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`No Supabase user for ${email}. Sign up in the app first.`);

  await db.from('categories').upsert(
    DEFAULT_CATEGORIES.map((seed, index) => ({
      user_id: user.id,
      name: seed.name,
      slug: seed.slug,
      sort_order: index,
      is_active: true,
      is_default: true,
      prompt_examples: seed.promptExamples,
    })),
    { onConflict: 'user_id,slug' }
  );

  const { data: categories, error: categoryError } = await db
    .from('categories')
    .select('id, slug')
    .eq('user_id', user.id);
  if (categoryError) throw categoryError;
  const bySlug = new Map(categories.map((c) => [c.slug as string, c.id as string]));

  const unmapped: Record<string, unknown> = {};

  // ── logs ──────────────────────────────────────────────────────────────────
  const legacyLogs = (legacy.logs ?? []).filter((l) => !l.demo && (l.body ?? '').trim().length > 0);
  const logRows = legacyLogs.map((l) => {
    const kind = l.kind ?? 'hard';
    return {
      user_id: user.id,
      occurred_on: l.occurred_at ?? new Date().toISOString().slice(0, 10),
      type: KIND_TO_TYPE[kind] ?? 'thought',
      category_id: bySlug.get(KIND_TO_CATEGORY[kind] ?? 'sonota'),
      body: (l.body ?? '').trim(),
    };
  });

  // place / people / tags have no home in the new model — kept, not discarded.
  const sidecar = legacyLogs
    .filter((l) => l.place || (l.people?.length ?? 0) > 0 || (l.tags?.length ?? 0) > 0)
    .map((l) => ({ body: l.body, place: l.place, people: l.people, tags: l.tags }));
  if (sidecar.length > 0) unmapped.logFields = sidecar;

  // ── month chapters become thought logs, so the writing survives ───────────
  const chapterRows = Object.entries(legacy.months ?? {})
    .filter(([, m]) => (m.chapter ?? '').trim().length > 0)
    .map(([ym, m]) => ({
      user_id: user.id,
      occurred_on: lastDayOf(ym),
      type: 'thought' as const,
      category_id: bySlug.get('sonota'),
      body: (m.chapter ?? '').trim(),
    }));

  const { data: existing } = await db.from('logs').select('body').eq('user_id', user.id);
  const seen = new Set((existing ?? []).map((l) => l.body as string));
  const toInsert = [...logRows, ...chapterRows].filter((r) => !seen.has(r.body));
  if (toInsert.length > 0) {
    const { error } = await db.from('logs').insert(toInsert);
    if (error) throw error;
  }

  // ── titles ────────────────────────────────────────────────────────────────
  const titleRows = [
    ...Object.entries(legacy.months ?? {})
      .filter(([, m]) => (m.title ?? '').trim().length > 0)
      .map(([ym, m]) => ({
        user_id: user.id,
        period_type: 'month' as const,
        period_key: ym,
        title: (m.title ?? '').trim(),
        source: 'manual' as const,
        is_confirmed: true,
      })),
    ...Object.entries(legacy.years ?? {})
      .filter(([, y]) => (y.title ?? '').trim().length > 0)
      .map(([year, y]) => ({
        user_id: user.id,
        period_type: 'year' as const,
        period_key: year,
        title: (y.title ?? '').trim(),
        source: 'manual' as const,
        is_confirmed: true,
      })),
  ];
  if (titleRows.length > 0) {
    const { error } = await db
      .from('period_titles')
      .upsert(titleRows, { onConflict: 'user_id,period_type,period_key' });
    if (error) throw error;
  }

  // ── things the MVP has no place for ───────────────────────────────────────
  if ((legacy.futures ?? []).length > 0) unmapped.futures = legacy.futures;
  const tones = Object.entries(legacy.months ?? {})
    .filter(([, m]) => m.tone || m.angle)
    .map(([ym, m]) => ({ ym, tone: m.tone, angle: m.angle }));
  if (tones.length > 0) unmapped.monthToneAndAngle = tones;

  if (Object.keys(unmapped).length > 0) {
    const out = `${inputPath}.unmapped.json`;
    writeFileSync(out, JSON.stringify(unmapped, null, 2));
    console.log(`Wrote fields with no home in the new model to ${out}`);
  }

  console.log(`Imported ${toInsert.length} logs (${chapterRows.length} of them month chapters).`);
  console.log(`Imported ${titleRows.length} titles.`);
  console.log('Skipped: Future Memo, month tone/angle, place/people/tags — see the unmapped file.');
  console.log('AI keywords are not migrated; they are produced by the analyze-log function.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
