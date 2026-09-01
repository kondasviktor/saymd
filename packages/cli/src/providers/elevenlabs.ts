import { readFile } from 'node:fs/promises';

import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

const TRANSCRIBE_MODEL = process.env.ELEVENLABS_TRANSCRIBE_MODEL ?? 'scribe_v2';
const USD_PER_MIN = 0.006;

export const elevenlabsProvider: TranscriptionProvider = {
  id: 'elevenlabs',
  displayName: 'ElevenLabs',
  model: TRANSCRIBE_MODEL,
  usdPerMinute: USD_PER_MIN,

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
    const buffer = await readFile(opts.localPath);
    const blob = new Blob([buffer], { type: opts.mimeType });
    const form = new FormData();
    form.append('file', blob, opts.localPath.split('/').pop() ?? 'audio');
    form.append('model_id', TRANSCRIBE_MODEL);
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
      model: TRANSCRIBE_MODEL,
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
      const t = await elevenlabsProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'elevenlabs',
      model: TRANSCRIBE_MODEL,
    };
  },
};
