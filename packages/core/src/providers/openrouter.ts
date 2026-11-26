import { loadAudio } from './audio-input.js';
import { trimSlash } from './openai-compatible.js';
import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

export function openrouterBaseUrl(): string {
  return process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1';
}

/**
 * OpenRouter: one key for many speech-to-text models (Gemini 3.5 Transcribe, GPT-4o (mini) Transcribe,
 * ElevenLabs Scribe v2, Deepgram Nova-3, Whisper …) via POST /audio/transcriptions with base64 JSON.
 * OpenRouter returns the actual cost (usage.cost), which is used instead of the estimate below.
 * Estimates: USD per audio minute from openrouter.ai/api/v1/models (26 Nov 2026).
 */
export const OPENROUTER_STT_MODELS: Record<string, number> = {
  'google/gemini-3.5-transcribe': 0.0054,
  'openai/gpt-4o-mini-transcribe': 0.003,
  'openai/gpt-4o-transcribe': 0.006,
  'elevenlabs/scribe-v2': 0.0036667,
  'deepgram/nova-3': 0.0043,
  'openai/whisper-large-v3-turbo': 0.0002,
  'openai/whisper-large-v3': 0.00045,
};
const DEFAULT_MODEL = 'google/gemini-3.5-transcribe';
const MODEL_ENV = 'OPENROUTER_TRANSCRIBE_MODEL';

/** OpenRouter's `input_audio.format` from a file name or MIME type. */
export function openrouterAudioFormat(filename: string, mimeType: string): string {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  const byExt: Record<string, string> = { ogg: 'ogg', oga: 'ogg', opus: 'ogg', m4a: 'm4a', mp4: 'm4a', mp3: 'mp3', mpeg: 'mp3', mpga: 'mp3', wav: 'wav', flac: 'flac', webm: 'webm', aac: 'aac' };
  if (byExt[ext]) return byExt[ext];
  const mime = mimeType.toLowerCase();
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('webm')) return 'webm';
  return 'ogg';
}

const defaultModel = (): string => process.env[MODEL_ENV]?.trim() || DEFAULT_MODEL;

/**
 * OpenRouter routing preferences sent with every request: only providers that do not store or train on the
 * content (`data_collection: "deny"`). OPENROUTER_DATA_COLLECTION=allow lifts this (not recommended).
 */
export function openrouterProviderPrefs(): { provider: { data_collection: 'deny' | 'allow' } } {
  return { provider: { data_collection: process.env.OPENROUTER_DATA_COLLECTION?.trim() === 'allow' ? 'allow' : 'deny' } };
}

async function apiFetch(apiKey: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${trimSlash(openrouterBaseUrl())}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://saymd.app',
      'X-Title': 'saymd',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

export const openrouterProvider: TranscriptionProvider = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  get model() {
    return defaultModel();
  },
  get usdPerMinute() {
    return OPENROUTER_STT_MODELS[defaultModel()] ?? OPENROUTER_STT_MODELS[DEFAULT_MODEL];
  },
  knownModels: OPENROUTER_STT_MODELS,
  modelEnvVar: MODEL_ENV,

  async verifyApiKey(apiKey: string): Promise<void> {
    await apiFetch(apiKey, '/key');
  },

  async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
    const { buffer, filename } = await loadAudio(opts);
    const model = opts.model?.trim() || defaultModel();
    const lang = opts.lang && opts.lang !== 'auto' ? opts.lang.slice(0, 2).toLowerCase() : undefined;
    const res = await apiFetch(apiKey, '/audio/transcriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input_audio: { data: Buffer.from(buffer).toString('base64'), format: openrouterAudioFormat(filename, opts.mimeType) },
        ...openrouterProviderPrefs(),
        ...(lang ? { language: lang } : {}),
      }),
    });
    const data = (await res.json()) as { text?: string; language?: string; usage?: { seconds?: number; cost?: number } };
    if (!data.text?.trim()) throw new Error('OpenRouter returned no transcription text.');
    return {
      text: data.text.trim(),
      language: data.language,
      provider: 'openrouter',
      model,
      durationSeconds: opts.durationSeconds ?? data.usage?.seconds,
      ...(typeof data.usage?.cost === 'number' ? { costUsd: data.usage.cost } : {}),
    };
  },

  async chunkAndTranscribe(apiKey, chunkPaths, mimeType, lang, model): Promise<Transcript> {
    const parts: string[] = [];
    let cost = 0;
    let costKnown = true;
    for (const p of chunkPaths) {
      const t = await openrouterProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang, model });
      parts.push(t.text);
      if (typeof t.costUsd === 'number') cost += t.costUsd;
      else costKnown = false;
    }
    return { text: parts.join('\n'), provider: 'openrouter', model: model?.trim() || defaultModel(), ...(costKnown ? { costUsd: cost } : {}) };
  },
};
