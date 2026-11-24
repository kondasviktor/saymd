import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';

import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

const DEFAULT_MODEL = 'gemini-3.5-transcribe';
function defaultModel(): string {
  return process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL;
}
const VERIFY_MODEL = process.env.GEMINI_ENRICH_MODEL ?? 'gemini-3.5-flash-lite';
/** Audio at 25 tokens/s plus transcript output tokens (see v2 unit economics). */
const USD_PER_MIN = 0.0054;

function languageName(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    hu: 'Hungarian',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    pl: 'Polish',
    cs: 'Czech',
    sk: 'Slovak',
    ro: 'Romanian',
    uk: 'Ukrainian',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
  };
  return map[code.toLowerCase()] ?? code;
}

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
  get model() {
    return defaultModel();
  },
  usdPerMinute: USD_PER_MIN,
  knownModels: { [DEFAULT_MODEL]: USD_PER_MIN },
  modelEnvVar: 'GEMINI_TRANSCRIBE_MODEL',

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
    const model = opts.model?.trim() || defaultModel();
    const audio = await uploadAudio(client, opts.localPath, opts.mimeType);
    const langHint =
      opts.lang && opts.lang !== 'auto'
        ? `The spoken language is ${languageName(opts.lang)} (${opts.lang}). Transcribe in that language.`
        : 'Detect the spoken language automatically and transcribe in that language.';
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: audio.uri, mimeType: audio.mimeType } },
            {
              text: `Transcribe this audio verbatim for a developer prompt dictation tool.
${langHint}
If the speaker means the product saymd (often pronounced "say M D"), spell it "saymd" — not Saint, Saint MD, or Saint Pro.
Keep tech terms like OAuth, Next.js, App Router, session cookie in their usual English spelling.`,
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
      const t = await geminiProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang, model });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'gemini',
      model: model?.trim() || defaultModel(),
    };
  },
};
