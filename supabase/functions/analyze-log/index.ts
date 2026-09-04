// Log analysis (spec §9.1).
// Runs after the log is already committed. A failure here returns an error to
// the caller but never touches the stored log.
import { createProvider } from '../_shared/llm.ts';
import { LOG_ANALYSIS_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser, serviceClient } from '../_shared/db.ts';

const ANALYSIS_VERSION = 'v1';

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    const user = await requireUser(request);
    const { log_id: logId } = (await request.json()) as { log_id?: string };
    if (!logId) return jsonResponse({ error: 'log_id is required' }, 400);

    const db = serviceClient();
    const { data: log, error } = await db
      .from('logs')
      .select('id, user_id, body, type, occurred_on')
      .eq('id', logId)
      .single();
    if (error || !log) return jsonResponse({ error: 'log not found' }, 404);
    if (log.user_id !== user.id) return jsonResponse({ error: 'forbidden' }, 403);

    const provider = createProvider();
    const raw = await provider.complete({
      system: LOG_ANALYSIS_SYSTEM,
      user: JSON.stringify({
        task: 'log_analysis',
        type: log.type,
        occurred_on: log.occurred_on,
        body: log.body,
      }),
      maxTokens: 400,
      temperature: 0.2,
    });

    const parsed = extractJson(raw) as {
      keywords?: unknown;
      semantic_tags?: unknown;
      tone?: unknown;
      confidence?: unknown;
    };

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === 'string').slice(0, 5)
      : [];
    const semanticTags = Array.isArray(parsed.semantic_tags)
      ? parsed.semantic_tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.toLowerCase().replace(/\s+/g, '_'))
          .slice(0, 8)
      : [];

    const row = {
      log_id: log.id,
      keywords,
      semantic_tags: semanticTags,
      tone: typeof parsed.tone === 'string' ? parsed.tone : null,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.min(1, Math.max(0, parsed.confidence))
          : null,
      model_name: `${provider.name}:${provider.model}`,
      analysis_version: ANALYSIS_VERSION,
      raw_json: parsed,
      updated_at: new Date().toISOString(),
    };

    const { error: writeError } = await db
      .from('log_ai_analysis')
      .upsert(row, { onConflict: 'log_id' });
    if (writeError) throw writeError;

    return jsonResponse({
      keywords,
      semantic_tags: semanticTags,
      tone: row.tone,
      confidence: row.confidence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
