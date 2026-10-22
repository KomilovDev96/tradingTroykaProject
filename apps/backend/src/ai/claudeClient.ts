import { env } from '../env';

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Anthropic's own rate-limit headers: the closest thing to «remaining limits» an API key can read. */
export interface RateLimitInfo {
  requestsRemaining: number | null;
  requestsLimit: number | null;
  inputTokensRemaining: number | null;
  inputTokensLimit: number | null;
  outputTokensRemaining: number | null;
  outputTokensLimit: number | null;
}

export interface ClaudeReply {
  text: string;
  usage: ClaudeUsage;
  rateLimit: RateLimitInfo;
}

const num = (value: string | null) => (value === null || value === '' || Number.isNaN(Number(value)) ? null : Number(value));

/** One Messages API call over plain fetch (no SDK dependency). Throws a short, key-free message on failure. */
export async function askClaude(system: string, user: string, maxTokens = 700): Promise<ClaudeReply> {
  if (!env.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.aiModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Claude API ${res.status}: ${body.error?.message ?? 'request failed'}`);
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
  const h = res.headers;
  return {
    text: data.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
    usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 },
    rateLimit: {
      requestsRemaining: num(h.get('anthropic-ratelimit-requests-remaining')),
      requestsLimit: num(h.get('anthropic-ratelimit-requests-limit')),
      inputTokensRemaining: num(h.get('anthropic-ratelimit-input-tokens-remaining')),
      inputTokensLimit: num(h.get('anthropic-ratelimit-input-tokens-limit')),
      outputTokensRemaining: num(h.get('anthropic-ratelimit-output-tokens-remaining')),
      outputTokensLimit: num(h.get('anthropic-ratelimit-output-tokens-limit')),
    },
  };
}
