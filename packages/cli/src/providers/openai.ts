import { readFile } from 'node:fs/promises';

import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

function transcribeModel(): string {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || 'gpt-4o-transcribe';
}

const USD_PER_MIN = 0.006;

function openaiBaseUrl(): string {
  const base = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  return base.replace(/\/$/, '');
}

async function openaiFetch(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`${openaiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res;
}

export const openaiProvider: TranscriptionProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  get model() {
    return transcribeModel();
  },
  usdPerMinute: USD_PER_MIN,

  async verifyApiKey(apiKey: string): Promise<void> {
    await openaiFetch(apiKey, '/models?limit=1');
  },

  async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
    const buffer = await readFile(opts.localPath);
    const blob = new Blob([buffer], { type: opts.mimeType });
    const form = new FormData();
    const model = transcribeModel();
    form.append('file', blob, opts.localPath.split('/').pop() ?? 'audio');
    form.append('model', model);
    form.append('response_format', 'json');
    if (opts.lang && opts.lang !== 'auto') {
      form.append('language', opts.lang);
    }

    const res = await openaiFetch(apiKey, '/audio/transcriptions', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { text?: string; language?: string };
    if (!data.text?.trim()) throw new Error('OpenAI returned no transcription text.');
    return {
      text: data.text.trim(),
      language: data.language,
      provider: 'openai',
      model,
      durationSeconds: opts.durationSeconds,
    };
  },

  async chunkAndTranscribe(
    apiKey: string,
    chunkPaths: string[],
    mimeType: string,
    lang?: string
  ): Promise<Transcript> {
    const parts: string[] = [];
    for (const p of chunkPaths) {
      const t = await openaiProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'openai',
      model: transcribeModel(),
    };
  },
};
