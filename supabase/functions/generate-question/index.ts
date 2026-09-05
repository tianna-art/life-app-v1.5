// STAGE 0 — the Level 3 question (§11-§13).
//
// The caller already has a usable question before this runs: the table in the
// app answers instantly and is sent along as `fallback`. This function only
// gets to improve on it, and its answer is discarded unless it is short and
// free of the reflective phrasing §12 forbids.
//
// That ordering is deliberate. The question sits between two taps and a save,
// so it is the one place in the app where latency would be felt, and the
// design makes the network optional rather than fast.
import { createProvider } from '../_shared/llm.ts';
import { QUESTION_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser } from '../_shared/db.ts';
import { isLogType, isMomentTag } from '../_shared/progressionRules.ts';

/** Long enough to answer in one breath; §11 says 10-40 characters. */
const MAX_QUESTION_LENGTH = 40;

/**
 * The questions the app took off the person's plate (§12). A question carrying
 * one of these has stopped collecting evidence and started asking for meaning.
 */
const FORBIDDEN = [
  '学び',
  '意味',
  'なぜ',
  'どうして',
  '感じました',
  '思いました',
  '成長',
  '人生',
  '強み',
  'あなたは',
];

function usable(question: string): boolean {
  const trimmed = question.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_QUESTION_LENGTH) return false;
  return !FORBIDDEN.some((phrase) => trimmed.includes(phrase));
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  let fallback: string | null = null;
  try {
    await requireUser(request);
    const body = (await request.json()) as {
      log_type?: unknown;
      moment_tags?: unknown;
      lenses?: unknown;
      month_theme?: unknown;
      fallback?: unknown;
    };

    fallback = typeof body.fallback === 'string' ? body.fallback : null;

    if (!isLogType(body.log_type)) return jsonResponse({ question: fallback });
    const tags = Array.isArray(body.moment_tags) ? body.moment_tags.filter(isMomentTag) : [];
    if (tags.length === 0) return jsonResponse({ question: fallback });

    const provider = createProvider();
    const raw = await provider.complete({
      system: QUESTION_SYSTEM,
      user: JSON.stringify({
        task: 'level3_question',
        log_type: body.log_type,
        moment_tags: tags,
        lenses: Array.isArray(body.lenses) ? body.lenses.slice(0, 6) : [],
        month_theme: typeof body.month_theme === 'string' ? body.month_theme : null,
        fallback,
      }),
      maxTokens: 400,
      temperature: 0.4,
    });

    const parsed = extractJson(raw) as { question?: unknown };
    const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
    return jsonResponse({ question: usable(question) ? question : fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    if (message === 'UNAUTHENTICATED') return jsonResponse({ error: message }, 401);
    // Any other failure returns the caller's own fallback rather than an
    // error: a question is never worth failing a save over.
    return jsonResponse({ question: fallback });
  }
});
