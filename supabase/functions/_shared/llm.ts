/**
 * LLM provider abstraction.
 *
 * The API key exists only here, in the Edge Function runtime, read from
 * Supabase secrets. It is never sent to, or referenced by, the mobile client.
 * Swapping providers is a config change, not a code change.
 */

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Returns raw model text. JSON parsing is the caller's job. */
  complete(request: LlmRequest): Promise<string>;
}

class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async complete({ system, user, maxTokens = 700, temperature = 0.4 }: LlmRequest): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!response.ok) {
      throw new Error(`anthropic ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }
}

class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async complete({ system, user, maxTokens = 700, temperature = 0.4 }: LlmRequest): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`openai ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

/**
 * Deterministic stand-in for local development and CI.
 *
 * It returns valid, schema-shaped JSON and reads nothing: every response is
 * the honest empty answer. That is deliberate — a mock that invented
 * progressions would make a broken pipeline look like a working one, and the
 * "nothing could be read here" path is the one most likely to regress
 * unnoticed.
 */
class MockProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock';

  complete({ user }: LlmRequest): Promise<string> {
    if (user.includes('"task":"log_extraction"')) {
      return Promise.resolve(
        JSON.stringify({
          event_summary: '',
          themes: [],
          people: [],
          action: null,
          outcome: null,
          friction: null,
          discovery: null,
          adaptation: null,
          choice: null,
          environment: null,
          interest_signal: null,
          journey_role: null,
          confidence: 0,
        })
      );
    }
    if (user.includes('"task":"cross_time_progression"')) {
      return Promise.resolve(JSON.stringify({ progressions: [] }));
    }
    if (user.includes('"task":"progression_consolidation"')) {
      return Promise.resolve(JSON.stringify({ merge: false }));
    }
    if (user.includes('"task":"level3_question"')) {
      // The caller's own table already answered; echoing nothing keeps it.
      return Promise.resolve(JSON.stringify({ question: '' }));
    }
    if (user.includes('"task":"progression_lens"')) {
      return Promise.resolve(JSON.stringify({ lenses: [] }));
    }
    if (user.includes('"task":"year_theme"')) {
      return Promise.resolve(JSON.stringify({ themes: [] }));
    }
    if (user.includes('"task":"month_theme"')) {
      return Promise.resolve(JSON.stringify({ candidates: [] }));
    }
    if (user.includes('"task":"year_review"')) {
      return Promise.resolve(JSON.stringify({ actual_story: '' }));
    }
    return Promise.resolve(
      JSON.stringify({
        what_actually_happened: '',
        changed: [],
        gained: [],
        title_candidates: [],
        title: 'A MONTH OF RECORDS',
        subtitle: '記録の残った月',
      })
    );
  }
}

export function createProvider(): LlmProvider {
  const kind = (Deno.env.get('LLM_PROVIDER') ?? 'mock').toLowerCase();
  const model = Deno.env.get('LLM_MODEL') ?? '';

  if (kind === 'anthropic') {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
    return new AnthropicProvider(key, model || 'claude-sonnet-5');
  }
  if (kind === 'openai') {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY is not set');
    return new OpenAiProvider(key, model || 'gpt-4o-mini');
  }
  return new MockProvider();
}
