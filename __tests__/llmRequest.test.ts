import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const llm = readFileSync(join(ROOT, 'supabase/functions/_shared/llm.ts'), 'utf8');

/**
 * The request shape the Edge Functions send to Anthropic.
 *
 * Checked as source rather than by calling it: these files run on Deno and are
 * outside the app's compiler, and this particular mistake is invisible from
 * inside the app — the analysis fails, the app answers locally instead, and
 * what the person sees is a button that does nothing.
 */
describe('the Anthropic request', () => {
  const anthropic = llm.slice(
    llm.indexOf('class AnthropicProvider'),
    llm.indexOf('class OpenAiProvider')
  );

  it('sends no sampling parameters', () => {
    // Sonnet 5 and the Opus 5 / 4.7 / 4.8 family removed these and answer a
    // request carrying one with a 400 — every call, not an occasional one.
    const body = anthropic.slice(anthropic.indexOf('body: JSON.stringify'));
    for (const banned of ['temperature', 'top_p', 'top_k']) {
      expect(body).not.toContain(banned);
    }
  });

  it('still sends what the request needs', () => {
    const body = anthropic.slice(anthropic.indexOf('body: JSON.stringify'));
    for (const required of ['model', 'max_tokens', 'system', 'messages']) {
      expect(body).toContain(required);
    }
  });

  it('keeps the whole budget for the answer', () => {
    // Sonnet 5 thinks by default and spends thinking out of max_tokens. On a
    // small budget the model can use the lot reasoning and return an empty
    // text block, which arrives downstream as "not a JSON object".
    expect(anthropic).toContain("thinking: { type: 'disabled' }");
  });

  it('names a cut-off answer rather than letting it look like nonsense', () => {
    expect(anthropic).toContain('stop_reason');
    expect(anthropic).toContain('cut off');
  });

  it('does not swallow a refusal from the provider', () => {
    // The status and the body are the only things that say which of several
    // causes it was, so both have to reach the caller.
    expect(anthropic).toContain('response.status');
    expect(anthropic).toContain('await response.text()');
  });
});
