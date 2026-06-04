const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DEFAULT_AI_REVIEW_MODEL =
  process.env.OPENROUTER_AI_REVIEW_MODEL || 'google/gemini-2.5-flash-lite';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterChatOptions {
  model?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function openRouterChat(options: OpenRouterChatOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = options.model ?? DEFAULT_AI_REVIEW_MODEL;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const referer = process.env.OPENROUTER_REFERER;
  const appTitle = process.env.OPENROUTER_APP_TITLE;
  if (referer) headers['HTTP-Referer'] = referer;
  if (appTitle) headers['X-Title'] = appTitle;

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 900,
  };
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned empty content');
  }
  return content;
}

export async function openRouterChatWithFallback(
  options: OpenRouterChatOptions
): Promise<{ content: string; model: string }> {
  const primary = options.model ?? DEFAULT_AI_REVIEW_MODEL;
  try {
    const content = await openRouterChat({ ...options, model: primary });
    return { content, model: primary };
  } catch (primaryErr) {
    const fallback = process.env.OPENROUTER_AI_REVIEW_FALLBACK_MODEL;
    if (!fallback || fallback === primary) {
      throw primaryErr;
    }
    const content = await openRouterChat({ ...options, model: fallback });
    return { content, model: fallback };
  }
}
