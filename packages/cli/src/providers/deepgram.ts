import { readFile } from 'node:fs/promises';

import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

const DEFAULT_MODEL = 'nova-3';
function defaultModel(): string {
  return process.env.DEEPGRAM_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL;
}
const USD_PER_MIN = 0.0052;

function buildListenUrl(model: string, lang?: string): string {
  const params = new URLSearchParams({
    model,
    smart_format: 'true',
    punctuate: 'true',
  });
  if (lang && lang !== 'auto') params.set('language', lang);
  else params.set('detect_language', 'true');
  return `https://api.deepgram.com/v1/listen?${params}`;
}

export const deepgramProvider: TranscriptionProvider = {
  id: 'deepgram',
  displayName: 'Deepgram',
  get model() {
    return defaultModel();
  },
  usdPerMinute: USD_PER_MIN,
  knownModels: { [DEFAULT_MODEL]: USD_PER_MIN },
  modelEnvVar: 'DEEPGRAM_TRANSCRIBE_MODEL',

  async verifyApiKey(apiKey: string): Promise<void> {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Deepgram API error (${res.status}): ${body.slice(0, 200)}`);
    }
  },

  async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
    const buffer = await readFile(opts.localPath);
    const model = opts.model?.trim() || defaultModel();
    const res = await fetch(buildListenUrl(model, opts.lang), {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': opts.mimeType,
      },
      body: buffer,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Deepgram transcription failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{ transcript?: string }>;
          detected_language?: string;
        }>;
      };
    };
    const channel = data.results?.channels?.[0];
    const text = channel?.alternatives?.[0]?.transcript?.trim();
    if (!text) throw new Error('Deepgram returned no transcription text.');
    return {
      text,
      language: channel?.detected_language,
      provider: 'deepgram',
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
      const t = await deepgramProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang, model });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'deepgram',
      model: model?.trim() || defaultModel(),
    };
  },
};
