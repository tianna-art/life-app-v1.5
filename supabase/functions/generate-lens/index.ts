// §4 and §5 — the year's lenses, and the three themes offered after them.
//
// Both are one function because they are one conversation: the themes are
// written from the lenses, and splitting them would mean sending the same
// selections twice.
//
// Nothing here is a goal. The lenses become detection priority inside
// analyze-log, and the theme is a name for the year that gets decided again at
// the end of it (§5).
import { createProvider } from '../_shared/llm.ts';
import { LENS_SYSTEM } from '../_shared/prompts.ts';
import { extractJson, jsonResponse, preflight } from '../_shared/json.ts';
import { requireUser } from '../_shared/db.ts';

const MAX_LENS_LENGTH = 12;
const MAX_THEME_LENGTH = 20;

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function cleanList(value: unknown, maxLength: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const cleaned = clean(item, maxLength);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  try {
    await requireUser(request);
    const body = (await request.json()) as {
      task?: unknown;
      selected_areas?: unknown;
      desired_self_cards?: unknown;
      lenses?: unknown;
    };

    const provider = createProvider();
    const wantsTheme = body.task === 'year_theme';

    const raw = await provider.complete({
      system: LENS_SYSTEM,
      user: JSON.stringify({
        task: wantsTheme ? 'year_theme' : 'progression_lens',
        selected_areas: Array.isArray(body.selected_areas) ? body.selected_areas : [],
        desired_self_cards: Array.isArray(body.desired_self_cards)
          ? body.desired_self_cards
          : [],
        lenses: Array.isArray(body.lenses) ? body.lenses : [],
      }),
      maxTokens: 900,
      temperature: 0.5,
    });

    const parsed = extractJson(raw) as { lenses?: unknown; themes?: unknown };

    if (wantsTheme) {
      return jsonResponse({ themes: cleanList(parsed.themes, MAX_THEME_LENGTH, 3) });
    }
    return jsonResponse({ lenses: cleanList(parsed.lenses, MAX_LENS_LENGTH, 6) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    // The caller has a fallback for both shapes, so an error here costs the
    // person nothing beyond a less graceful set of words.
    return jsonResponse({ error: message }, status);
  }
});
