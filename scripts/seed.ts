/**
 * Seed script — run locally, never bundled into the app.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_EMAIL=you@example.com \
 *   SEED_PASSWORD=... npm run seed
 *
 * Creates (or reuses) one user, seeds the default categories, and writes a
 * spread of logs across the last few months so MAP and LIST have something
 * real to show. Idempotent: re-running does not duplicate logs.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CATEGORIES } from '../src/constants/categories';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL ?? 'demo@crincran.app';
const password = process.env.SEED_PASSWORD ?? 'crincran-demo-1234';

if (!url || !serviceRoleKey) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n' +
      'Find them in Supabase > Project Settings > API. Never put the service role key in .env of the app.'
  );
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const SAMPLE: Array<{ slug: string; type: 'event' | 'thought'; body: string; daysAgo: number }> = [
  { slug: 'tsumiage', type: 'event', body: '新しい企画の骨組みを書き出した。', daysAgo: 2 },
  { slug: 'tsumiage', type: 'thought', body: '完成させるより、まず人に見せる形にする方が早く進む気がする。', daysAgo: 3 },
  { slug: 'tokimeki', type: 'event', body: '美術館の常設展を見に行った。', daysAgo: 5 },
  { slug: 'tokimeki', type: 'thought', body: '古い天体図の前で長く立ち止まっていた。理由はうまく言えない。', daysAgo: 5 },
  { slug: 'kankeisei', type: 'thought', body: '答えをもらうより、一緒に考えてもらえた打ち合わせの方が手が動いた。', daysAgo: 8 },
  { slug: 'hikkakari', type: 'thought', body: '進め方を自分で決められない場面が続くと、量に関係なく重くなる。', daysAgo: 11 },
  { slug: 'kyokun', type: 'thought', body: '次は最初に粗い版を出して、そこから削る順番にしてみる。', daysAgo: 12 },
  { slug: 'tsumiage', type: 'event', body: '試作を2つ作って比較した。', daysAgo: 16 },
  { slug: 'tokimeki', type: 'event', body: '知らない人の展示レビューを最後まで読んだ。', daysAgo: 20 },
  { slug: 'kankeisei', type: 'event', body: '前職の同僚と久しぶりに話した。', daysAgo: 26 },
  { slug: 'tsumiage', type: 'event', body: '章立てを書き直した。', daysAgo: 34 },
  { slug: 'kyokun', type: 'thought', body: '締め切りを先に置くと、迷っている時間が短くなる。', daysAgo: 40 },
  { slug: 'hikkakari', type: 'thought', body: '説明が長くなるときは、たいてい自分がまだ決めていない。', daysAgo: 48 },
  { slug: 'tokimeki', type: 'event', body: '古い星図の複製を買った。', daysAgo: 55 },
  { slug: 'kankeisei', type: 'thought', body: '安心して質問できる相手だと、確認の往復が減る。', daysAgo: 62 },
  { slug: 'sonota', type: 'thought', body: '朝の30分だけ、何も予定を入れない日を作ってみている。', daysAgo: 70 },
];

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
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

  await db.from('categories').upsert(
    DEFAULT_CATEGORIES.map((seed, index) => ({
      user_id: userId,
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
    .eq('user_id', userId);
  if (categoryError) throw categoryError;
  const bySlug = new Map(categories.map((c) => [c.slug as string, c.id as string]));

  const { data: existingLogs } = await db.from('logs').select('body').eq('user_id', userId);
  const existingBodies = new Set((existingLogs ?? []).map((l) => l.body as string));

  const rows = SAMPLE.filter((s) => !existingBodies.has(s.body)).map((s) => ({
    user_id: userId,
    occurred_on: isoDaysAgo(s.daysAgo),
    type: s.type,
    category_id: bySlug.get(s.slug),
    body: s.body,
  }));

  if (rows.length > 0) {
    const { error } = await db.from('logs').insert(rows);
    if (error) throw error;
  }

  console.log(`Seeded ${rows.length} logs (${SAMPLE.length - rows.length} already present).`);
  console.log(`Sign in as: ${email} / ${password}`);
  console.log('AI analysis is not seeded — it is produced by the analyze-log Edge Function.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
