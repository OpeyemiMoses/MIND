import { z } from 'zod';
import { getActiveLlmInfo, getServerEnv } from '@/lib/env';

export interface LlmGenerationOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  timeoutMs?: number;
}

export interface LlmGenerationResult<T> {
  data: T;
  provider: 'groq' | 'gemini' | 'openai' | 'openai-compatible';
  model: string;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Model response was not valid JSON');
  }
}

export async function generateStructuredJson<T>(
  options: LlmGenerationOptions<T>
): Promise<LlmGenerationResult<T> | null> {
  const info = getActiveLlmInfo();
  if (!info.configured || info.provider === 'none') {
    return null;
  }

  const env = getServerEnv();
  const temperature = options.temperature ?? 0.2;
  const timeoutMs = options.timeoutMs ?? 28_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (info.provider === 'gemini' && env.GEMINI_API_KEY) {
      const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: options.systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: options.userPrompt }],
            },
          ],
          generationConfig: {
            temperature,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Gemini API HTTP ${res.status}: ${errBody.slice(0, 180)}`);
      }

      const payload = await res.json();
      const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        throw new Error('Empty response text from Gemini API');
      }

      const parsed = extractJsonObject(rawText);
      const validated = options.schema.parse(parsed);
      return {
        data: validated,
        provider: 'gemini',
        model,
      };
    }

    // Groq (primary), OpenAI, or OpenAI-compatible
    const apiKey =
      info.provider === 'groq'
        ? env.GROQ_API_KEY || env.LLM_API_KEY
        : info.provider === 'openai-compatible'
        ? env.LLM_API_KEY
        : env.OPENAI_API_KEY || env.LLM_API_KEY;

    const baseUrl = (
      info.provider === 'groq'
        ? env.GROQ_BASE_URL
        : info.provider === 'openai-compatible' && env.LLM_BASE_URL
        ? env.LLM_BASE_URL
        : 'https://api.openai.com/v1'
    ).replace(/\/$/, '');

    const model = info.model;

    if (!apiKey) {
      return null;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`${info.provider.toUpperCase()} API HTTP ${res.status}: ${errBody.slice(0, 180)}`);
    }

    const payload = await res.json();
    const rawText = payload?.choices?.[0]?.message?.content || '';
    if (!rawText) {
      throw new Error('Empty response text from Chat Completions API');
    }

    const parsed = extractJsonObject(rawText);
    const validated = options.schema.parse(parsed);
    return {
      data: validated,
      provider: info.provider,
      model,
    };
  } catch (err) {
    console.warn('Structured LLM generation error (falling back to deterministic synthesis):', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
