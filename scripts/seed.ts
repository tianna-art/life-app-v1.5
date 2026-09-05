/**
 * Seed script — run locally, never bundled into the app.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_EMAIL=you@example.com \
 *   SEED_PASSWORD=... npm run seed
 *
 * Creates (or reuses) one user, sets a year direction, and writes a spread of
 * records across the last few months. The records are deliberately three real
 * trails — a fear stated, a first attempt, something that did not land, a
 * change of approach, then the same thing done differently — because a
 * Progression is only visible across records, and a scatter of unrelated days
 * would prove nothing.
 *
 * Most of them carry no free text, which is the normal case in v4: the tags
 * are the evidence. A few have answers, so the reading has something to name
 * the trails with.
 *
 * Progressions and gains are NOT seeded: they are produced by the analyze-log
 * Edge Function, and inventing them here would hide whether detection works.
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

type LogType = 'self_action' | 'relationship' | 'thought';
type MomentTag =
  | 'enjoyed'
  | 'tried'
  | 'first_time'
  | 'friction'
  | 'changed'
  | 'discovered'
  | 'self_decided';

interface Sample {
  type: LogType;
  tags: MomentTag[];
  daysAgo: number;
  question?: string;
  answer?: string;
}

const SAMPLE: Sample[] = [
  // 人に伝える — PIVOT and EXPOSE. A fear, a first attempt, a failure, a
  // change of method, and the same thing with a stranger.
  {
    type: 'thought',
    tags: ['friction'],
    daysAgo: 150,
    question: '何が一番引っかかった？',
    answer: '人に見せるのが怖い',
  },
  {
    type: 'relationship',
    tags: ['first_time', 'tried'],
    daysAgo: 120,
    question: '誰に見せてみた？',
    answer: '友達ひとり',
  },
  { type: 'self_action', tags: ['friction'], daysAgo: 96 },
  {
    type: 'thought',
    tags: ['discovered'],
    daysAgo: 92,
    question: '前より何がはっきりした？',
    answer: '結論から話した方がいい',
  },
  {
    type: 'self_action',
    tags: ['changed', 'tried'],
    daysAgo: 64,
    question: '前と何を変えた？',
    answer: '結論から説明した',
  },
  { type: 'relationship', tags: ['first_time'], daysAgo: 22 },

  // つくる — REPEAT. Finish first, then show; show mid-way; verify early.
  { type: 'self_action', tags: ['tried'], daysAgo: 128 },
  { type: 'self_action', tags: ['friction'], daysAgo: 124 },
  {
    type: 'relationship',
    tags: ['tried', 'enjoyed'],
    daysAgo: 88,
    question: '誰に見せてみた？',
    answer: '途中の状態のまま友人に',
  },
  { type: 'self_action', tags: ['tried'], daysAgo: 40 },
  { type: 'self_action', tags: ['tried', 'enjoyed'], daysAgo: 12 },

  // 働き方 — BOUNDARY and OWN-CALL. A setback left as a setback, and a
  // direction forming out of it.
  { type: 'thought', tags: ['friction'], daysAgo: 140 },
  { type: 'self_action', tags: ['enjoyed'], daysAgo: 100 },
  { type: 'thought', tags: ['friction', 'discovered'], daysAgo: 72 },
  {
    type: 'self_action',
    tags: ['self_decided'],
    daysAgo: 44,
    question: '何を自分で選んだ？',
    answer: '進め方を決められる仕事だけ受けた',
  },
  { type: 'self_action', tags: ['self_decided'], daysAgo: 10 },

  // Records that belong to no trail. The map should leave these alone.
  { type: 'self_action', tags: ['enjoyed'], daysAgo: 55 },
  { type: 'relationship', tags: ['enjoyed'], daysAgo: 5 },
  { type: 'self_action', tags: ['tried'], daysAgo: 33 },
];

/**
 * The lens this demo is read through (§2-§4).
 *
 * Chosen to match the trails above, so the seeded account shows what a lens
 * actually does: the same records read differently with a different one.
 */
const YEAR_DIRECTION = {
  selected_areas: ['own_name_and_taste', 'own_way_of_working', 'own_axis'],
  desired_self_cards: [
    'do_make_ideas_real',
    'express_show_ideas',
    'express_to_strangers',
    'choose_decide_myself',
    'live_more_fun',
  ],
  progression_lenses: ['形にする', '外に出す', '自分で選ぶ', '自分に合うものを知る'],
  initial_theme: '自分の感性を、外の世界へ',
};

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

  await db.from('year_directions').upsert(
    { user_id: userId, year: new Date().getFullYear(), ...YEAR_DIRECTION },
    { onConflict: 'user_id,year' }
  );

  // Idempotent on the timestamp: re-running does not duplicate records, and
  // there is no body to compare on any more.
  const { data: existing } = await db.from('logs').select('occurred_at').eq('user_id', userId);
  const seen = new Set((existing ?? []).map((l) => l.occurred_at as string));

  const rows = SAMPLE.map((s) => ({ sample: s, occurredAt: isoDaysAgo(s.daysAgo) }))
    .filter(({ occurredAt }) => !seen.has(occurredAt))
    .map(({ sample, occurredAt }) => ({
      user_id: userId,
      occurred_at: occurredAt,
      occurred_on: occurredAt.slice(0, 10),
      type: sample.type,
      moment_tags: sample.tags,
      ai_question: sample.question ?? null,
      optional_answer: sample.answer ?? null,
    }));

  if (rows.length > 0) {
    const { error } = await db.from('logs').insert(rows);
    if (error) throw error;
  }

  console.log(`Seeded ${rows.length} records (${SAMPLE.length - rows.length} already present).`);
  console.log(`Sign in as: ${email} / ${password}`);
  console.log('Progressions come from the analyze-log Edge Function, not from this script.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
