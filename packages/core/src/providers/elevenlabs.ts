import { loadAudio } from './audio-input.js';
import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

const DEFAULT_MODEL = 'scribe_v3';
/** Scribe v3: $0.20/hr list price; v2 kept for anyone pinning it. */
const KNOWN_MODELS: Record<string, number> = {
  scribe_v3: 0.0033,
  scribe_v2: 0.0067,
};

function defaultModel(): string {
  return process.env.ELEVENLABS_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL;
}

export const elevenlabsProvider: TranscriptionProvider = {
  id: 'elevenlabs',
  displayName: 'ElevenLabs',
  get model() {
    return defaultModel();
  },
  get usdPerMinute() {
    return KNOWN_MODELS[defaultModel()] ?? KNOWN_MODELS[DEFAULT_MODEL];
  },
  knownModels: KNOWN_MODELS,
  modelEnvVar: 'ELEVENLABS_TRANSCRIBE_MODEL',

  async verifyApiKey(apiKey: string): Promise<void> {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ElevenLabs API error (${res.status}): ${body.slice(0, 200)}`);
    }
  },

  async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
    const { buffer, filename } = await loadAudio(opts);
    const blob = new Blob([buffer], { type: opts.mimeType });
    const form = new FormData();
    const model = opts.model?.trim() || defaultModel();
    form.append('file', blob, filename);
    form.append('model_id', model);
    if (opts.lang && opts.lang !== 'auto') {
      form.append('language_code', opts.lang);
    }

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ElevenLabs transcription failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string; language_code?: string };
    if (!data.text?.trim()) throw new Error('ElevenLabs returned no transcription text.');
    return {
      text: data.text.trim(),
      language: data.language_code,
      provider: 'elevenlabs',
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
      const t = await elevenlabsProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang, model });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'elevenlabs',
      model: model?.trim() || defaultModel(),
    };
  },
};
