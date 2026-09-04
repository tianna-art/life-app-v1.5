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
 * Deterministic stand-in for local development and CI. It returns valid,
 * evidence-shaped JSON without asserting anything about the person.
 */
class MockProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock';

  complete({ user }: LlmRequest): Promise<string> {
    if (user.includes('"task":"log_analysis"')) {
      return Promise.resolve(
        JSON.stringify({
          keywords: ['記録'],
          semantic_tags: ['unclassified'],
          tone: 'unspecified',
          confidence: 0.2,
        })
      );
    }
    if (user.includes('"task":"category_insight"')) {
      return Promise.resolve(
        JSON.stringify({
          insight: 'この期間の記録は、まだ十分な傾向として見えるところまでは来ていません。',
          keywords: [],
        })
      );
    }
    return Promise.resolve(
      JSON.stringify({
        candidates: [
          { title: '静かに続いた期間', reason: '記録が残っていることだけを根拠にしています。' },
          { title: '点を置き続けた期間', reason: '評価を含まない呼び名です。' },
          { title: 'まだ言葉になっていない期間', reason: '断定を避けた案です。' },
        ],
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
    return new AnthropicProvider(key, model || 'claude-sonnet-4-5');
  }
  if (kind === 'openai') {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY is not set');
    return new OpenAiProvider(key, model || 'gpt-4o-mini');
  }
  return new MockProvider();
}
