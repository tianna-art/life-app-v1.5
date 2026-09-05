/**
 * Seed script — run locally, never bundled into the app.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_EMAIL=you@example.com \
 *   SEED_PASSWORD=... npm run seed
 *
 * Creates (or reuses) one user and writes a spread of entries across the last
 * few months. The entries are deliberately a real trail — a fear stated, a
 * first attempt, something that did not land, a change of approach, then the
 * same thing done differently — because a Progression is only visible across
 * records, and a scatter of unrelated days would prove nothing.
 *
 * Progressions themselves are NOT seeded: they are produced by the
 * analyze-entry Edge Function, and inventing them here would hide whether the
 * detection actually works.
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

type EntryType = 'event' | 'thought';
type SubjectiveSignal = 'positive' | 'mixed' | 'negative';

const SAMPLE: Array<{
  type: EntryType;
  body: string;
  subjectiveSignal: SubjectiveSignal;
  daysAgo: number;
}> = [
  // 人に伝える — a fear, a first attempt, a failure, a change of method, and
  // the same thing done with a stranger. This is the trail the map should find.
  { type: 'thought', body: '人に自分の企画を見せるのが怖い。', subjectiveSignal: 'negative', daysAgo: 150 },
  { type: 'event', body: '初めて自分の企画を友達に見せた。', subjectiveSignal: 'positive', daysAgo: 120 },
  { type: 'event', body: '企画を説明したけれど、情報が多くて伝わらなかった。', subjectiveSignal: 'negative', daysAgo: 96 },
  { type: 'thought', body: '結論から話した方がいいのかもしれない。', subjectiveSignal: 'mixed', daysAgo: 92 },
  { type: 'event', body: '結論から説明してみたら、前より話が早かった。', subjectiveSignal: 'positive', daysAgo: 64 },
  { type: 'event', body: '初対面の人にも企画を説明した。', subjectiveSignal: 'positive', daysAgo: 22 },

  // つくる — finish first, then show; show mid-way; verify from the start.
  { type: 'event', body: '企画書を最後まで作り込んでから共有した。', subjectiveSignal: 'mixed', daysAgo: 128 },
  { type: 'event', body: '共有した企画に、ほとんど反応がなかった。', subjectiveSignal: 'negative', daysAgo: 124 },
  { type: 'event', body: '途中の状態のまま、友人ひとりに見せてみた。', subjectiveSignal: 'positive', daysAgo: 88 },
  { type: 'thought', body: '途中で見せた方が、返ってくるのが早い。', subjectiveSignal: 'positive', daysAgo: 86 },
  { type: 'event', body: '今回は骨組みの段階で3人に見せてから作り込んだ。', subjectiveSignal: 'positive', daysAgo: 40 },
  { type: 'event', body: '粗い版を先に出して、そこから削る順番で進めた。', subjectiveSignal: 'positive', daysAgo: 12 },

  // 働き方 — a setback that is left as a setback, and a direction forming.
  { type: 'thought', body: '今の仕事を辞めたいと思っている。', subjectiveSignal: 'negative', daysAgo: 140 },
  { type: 'event', body: '自分で進め方を決められる打ち合わせは、終わったあとも手が動いた。', subjectiveSignal: 'positive', daysAgo: 100 },
  { type: 'thought', body: '進め方を決められない場面が続くと、量に関係なく重くなる。', subjectiveSignal: 'negative', daysAgo: 72 },
  { type: 'thought', body: '企画職が気になっている。', subjectiveSignal: 'mixed', daysAgo: 44 },
  { type: 'thought', body: '自分で企画できる環境がほしいのだと思う。', subjectiveSignal: 'positive', daysAgo: 10 },

  // Records that belong to no trail. The map should leave these alone.
  { type: 'event', body: '古い星図の複製を買った。', subjectiveSignal: 'positive', daysAgo: 55 },
  { type: 'event', body: '美術館の常設展を見に行った。', subjectiveSignal: 'positive', daysAgo: 5 },
  { type: 'event', body: '歯医者に行った。', subjectiveSignal: 'mixed', daysAgo: 33 },
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
      type: s.type,
      subjective_signal: s.subjectiveSignal,
      body: s.body,
    };
  });

  if (rows.length > 0) {
    const { error } = await db.from('logs').insert(rows);
    if (error) throw error;
  }

  console.log(`Seeded ${rows.length} entries (${SAMPLE.length - rows.length} already present).`);
  console.log(`Sign in as: ${email} / ${password}`);
  console.log('Progressions are produced by the analyze-entry Edge Function, not by this script.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
