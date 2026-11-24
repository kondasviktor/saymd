import { readFile } from 'node:fs/promises';

import type { SttProviderId, TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

export interface OpenAiCompatibleSttConfig {
  id: SttProviderId;
  displayName: string;
  /** Base URL including the API version, e.g. https://api.openai.com/v1 */
  baseUrl: () => string;
  defaultModel: string;
  modelEnvVar: string;
  /** Model → USD per minute. Must include defaultModel. */
  knownModels: Record<string, number>;
  minBilledSeconds?: number;
}

export function trimSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Transcription provider for any OpenAI-compatible `/audio/transcriptions` API (OpenAI, Groq). */
export function createOpenAiCompatibleStt(cfg: OpenAiCompatibleSttConfig): TranscriptionProvider {
  const defaultModel = (): string => process.env[cfg.modelEnvVar]?.trim() || cfg.defaultModel;

  async function apiFetch(apiKey: string, path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${trimSlash(cfg.baseUrl())}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${cfg.displayName} API error (${res.status}): ${body.slice(0, 200)}`);
    }
    return res;
  }

  const provider: TranscriptionProvider = {
    id: cfg.id,
    displayName: cfg.displayName,
    get model() {
      return defaultModel();
    },
    get usdPerMinute() {
      return cfg.knownModels[defaultModel()] ?? cfg.knownModels[cfg.defaultModel];
    },
    knownModels: cfg.knownModels,
    modelEnvVar: cfg.modelEnvVar,
    minBilledSeconds: cfg.minBilledSeconds,

    async verifyApiKey(apiKey: string): Promise<void> {
      await apiFetch(apiKey, '/models');
    },

    async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
      const buffer = await readFile(opts.localPath);
      const blob = new Blob([buffer], { type: opts.mimeType });
      const form = new FormData();
      const model = opts.model?.trim() || defaultModel();
      form.append('file', blob, opts.localPath.split('/').pop() ?? 'audio');
      form.append('model', model);
      form.append('response_format', 'json');
      if (opts.lang && opts.lang !== 'auto') {
        form.append('language', opts.lang);
      }

      const res = await apiFetch(apiKey, '/audio/transcriptions', {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as { text?: string; language?: string };
      if (!data.text?.trim()) throw new Error(`${cfg.displayName} returned no transcription text.`);
      return {
        text: data.text.trim(),
        language: data.language,
        provider: cfg.id,
        model,
        durationSeconds: opts.durationSeconds,
      };
    },

    async chunkAndTranscribe(
      apiKey: string,
      chunkPaths: string[],
      mimeType: string,
      lang?: string,
      model?: string
    ): Promise<Transcript> {
      const parts: string[] = [];
      for (const p of chunkPaths) {
        const t = await provider.transcribeFile(apiKey, { localPath: p, mimeType, lang, model });
        parts.push(t.text);
      }
      return {
        text: parts.join('\n'),
        provider: cfg.id,
        model: model?.trim() || defaultModel(),
      };
    },
  };
  return provider;
}
