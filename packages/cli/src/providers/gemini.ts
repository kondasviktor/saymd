import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';

import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL ?? 'gemini-3.5-transcribe';
const VERIFY_MODEL = process.env.GEMINI_ENRICH_MODEL ?? 'gemini-3.5-flash-lite';
const USD_PER_MIN = 0.005;

function extractTranscriptionText(response: {
  candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
  text?: string;
}): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const chunks: string[] = [];
  for (const part of parts) {
    const t = part.audioTranscription as { text?: string } | undefined;
    if (t?.text?.trim()) chunks.push(t.text.trim());
    else if (typeof part.text === 'string' && part.text.trim()) chunks.push(part.text.trim());
  }
  if (chunks.length) return chunks.join('\n');
  if (response.text?.trim()) return response.text.trim();
  throw new Error('Gemini returned no transcription text.');
}

async function uploadAudio(client: GoogleGenAI, localPath: string, mimeType: string) {
  const buffer = await readFile(localPath);
  const blob = new Blob([buffer], { type: mimeType });
  const uploaded = await client.files.upload({
    file: blob,
    config: { mimeType, displayName: localPath.split('/').pop() ?? 'audio' },
  });
  if (!uploaded.uri) throw new Error('File upload failed.');
  return { uri: uploaded.uri, mimeType: uploaded.mimeType ?? mimeType };
}

export const geminiProvider: TranscriptionProvider = {
  id: 'gemini',
  displayName: 'Google Gemini',
  model: TRANSCRIBE_MODEL,
  usdPerMinute: USD_PER_MIN,

  async verifyApiKey(apiKey: string): Promise<void> {
    const client = new GoogleGenAI({ apiKey });
    await client.models.generateContent({
      model: VERIFY_MODEL,
      contents: 'Reply {"ok":true} as JSON only.',
      config: { responseMimeType: 'application/json', maxOutputTokens: 16 },
    });
  },

  async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
    const client = new GoogleGenAI({ apiKey });
    const audio = await uploadAudio(client, opts.localPath, opts.mimeType);
    const langHint =
      opts.lang && opts.lang !== 'auto'
        ? `The spoken language is ${opts.lang}.`
        : 'Detect the spoken language automatically.';
    const response = await client.models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: audio.uri, mimeType: audio.mimeType } },
            {
              text: `Transcribe this audio verbatim for a developer prompt dictation tool.\n${langHint}`,
            },
          ],
        },
      ],
      config: { temperature: 0.2 },
    });
    return {
      text: extractTranscriptionText(
        response as {
          candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
          text?: string;
        }
      ),
      provider: 'gemini',
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
      const t = await geminiProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'gemini',
      model: TRANSCRIBE_MODEL,
    };
  },
};
