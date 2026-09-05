/**
 * Seed script — run locally, never bundled into the app.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_EMAIL=you@example.com \
 *   SEED_PASSWORD=... npm run seed
 *
 * Creates (or reuses) one user and writes a spread of entries across the last
 * few months. The entries are deliberately a real trail — something tried,
 * something that did not land, a change of approach, then the same thing tried
 * differently — because that is what the gain pipeline is supposed to be able
 * to read. Idempotent: re-running does not duplicate entries.
 *
 * Gains themselves are NOT seeded: they are produced by the analyze-log Edge
 * Function, and inventing them here would hide whether that function works.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL ?? 'demo@crincran.app';
const password = process.env.SEED_PASSWORD ?? 'crincran-demo-1234';

if (!url || !serviceRoleKey) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n' +
      'Find them in Supabase > Project Settings > API. Never put the service role key in the app .env.'
  );
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

type InputCategory = 'progress' | 'friction' | 'moved';

const SAMPLE: Array<{ inputCategory: InputCategory; body: string; daysAgo: number }> = [
  // A strand that should end up as a STRATEGY gain, failure and all.
  { inputCategory: 'progress', body: '企画書を最後まで作り込んでから共有した。', daysAgo: 68 },
  { inputCategory: 'friction', body: '共有した企画に、ほとんど反応がなかった。', daysAgo: 64 },
  { inputCategory: 'progress', body: '途中の状態のまま、友人ひとりに見せてみた。', daysAgo: 52 },
  { inputCategory: 'moved', body: '途中で見せた方が、returnが早いことに驚いた。', daysAgo: 51 },
  { inputCategory: 'progress', body: '今回は骨組みの段階で3人に見せてから作り込んだ。', daysAgo: 34 },
  { inputCategory: 'progress', body: '粗い版を先に出して、そこから削る順番で進めた。', daysAgo: 12 },

  // A strand that should read as DIRECTION, never as a personality claim.
  { inputCategory: 'moved', body: '自分で進め方を決められる打ち合わせは、終わったあとも手が動いた。', daysAgo: 62 },
  { inputCategory: 'friction', body: '進め方を決められない場面が続くと、量に関係なく重くなる。', daysAgo: 44 },
  { inputCategory: 'moved', body: '少人数で作っている時間の方が、集中が続いている気がする。', daysAgo: 20 },

  // EVIDENCE: things that simply happened, and are now facts about the past.
  { inputCategory: 'progress', body: 'はじめてイベントを開催した。', daysAgo: 40 },
  { inputCategory: 'progress', body: 'ポートフォリオを公開した。', daysAgo: 26 },
  { inputCategory: 'progress', body: '試作を2つ作って比較した。', daysAgo: 16 },

  // CONNECTION.
  { inputCategory: 'moved', body: '同じテーマに興味を持っている人と話した。', daysAgo: 30 },
  { inputCategory: 'moved', body: '前職の同僚と久しぶりに話して、相談できる相手が増えた。', daysAgo: 8 },

  // Ordinary days that should stay unresolved.
  { inputCategory: 'moved', body: '古い星図の複製を買った。', daysAgo: 55 },
  { inputCategory: 'moved', body: '美術館の常設展を見に行った。', daysAgo: 5 },
  { inputCategory: 'friction', body: '説明が長くなってしまった。', daysAgo: 3 },
];

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(21, 0, 0, 0);
  return date.toISOString();
}

async function resolveUserId(): Promise<string> {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    console.log(`Created user ${email}`);
    return created.user.id;
  }
  if (error && !/already/i.test(error.message)) throw error;

  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Could not create or find ${email}`);
  console.log(`Reusing user ${email}`);
  return existing.id;
}

async function main(): Promise<void> {
  const userId = await resolveUserId();

  await db.from('profiles').upsert({ id: userId }, { onConflict: 'id' });

  const { data: existing } = await db.from('logs').select('body').eq('user_id', userId);
  const existingBodies = new Set((existing ?? []).map((l) => l.body as string));

  const rows = SAMPLE.filter((s) => !existingBodies.has(s.body)).map((s) => {
    const occurredAt = isoDaysAgo(s.daysAgo);
    return {
      user_id: userId,
      occurred_at: occurredAt,
      occurred_on: occurredAt.slice(0, 10),
      input_category: s.inputCategory,
      body: s.body,
    };
  });

  if (rows.length > 0) {
    const { error } = await db.from('logs').insert(rows);
    if (error) throw error;
  }

  console.log(`Seeded ${rows.length} entries (${SAMPLE.length - rows.length} already present).`);
  console.log(`Sign in as: ${email} / ${password}`);
  console.log('Gains are produced by the analyze-log Edge Function, not by this script.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
