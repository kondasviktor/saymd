import type { GoogleGenAI } from '@google/genai';

import { loadAudio } from './audio-input.js';
import { geminiClient, geminiTextModel } from './gemini-client.js';
import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

const DEFAULT_MODEL = 'gemini-3.5-transcribe';
function defaultModel(): string {
  return process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL;
}
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

async function uploadAudio(client: GoogleGenAI, opts: TranscribeOptions) {
  const { buffer, filename } = await loadAudio(opts);
  const mimeType = opts.mimeType;
  const blob = new Blob([buffer], { type: mimeType });
  const uploaded = await client.files.upload({
    file: blob,
    config: { mimeType, displayName: filename },
  });
  if (!uploaded.uri || !uploaded.name) throw new Error('File upload failed.');
  return { uri: uploaded.uri, mimeType: uploaded.mimeType ?? mimeType, name: uploaded.name };
}

/** Dedicated speech-to-text models (gemini-3.5-transcribe) run on the Interactions API. */
export function isDedicatedTranscribeModel(model: string): boolean {
  return /(^|\/)gemini-[\d.]+-transcribe(?!-live)/.test(model);
}

/** Terms to bias recognition towards: the product name plus Pro vocabulary. Max 1,000. */
export function transcribeVocabulary(vocabulary?: string[]): string[] {
  return [...new Set(['saymd', ...(vocabulary ?? [])].map((t) => t.trim()).filter(Boolean))].slice(0, 1000);
}

async function transcribeWithInteractions(
  client: GoogleGenAI,
  model: string,
  audio: { uri: string; mimeType: string },
  lang?: string,
  vocabulary?: string[]
): Promise<string> {
  const interaction = await client.interactions.create({
    model,
    input: [{ type: 'audio', uri: audio.uri, mime_type: audio.mimeType }],
    generation_config: {
      transcription_config: {
        ...(lang && lang !== 'auto' ? { language_codes: [lang] } : {}),
        custom_vocabulary: transcribeVocabulary(vocabulary),
      },
    },
  });
  const text = interaction.output_text?.trim();
  if (!text) throw new Error('Gemini returned no transcription text.');
  return text;
}

async function transcribeUploaded(
  client: GoogleGenAI,
  model: string,
  audio: { uri: string; mimeType: string; name: string },
  opts: TranscribeOptions
): Promise<Transcript> {
  if (isDedicatedTranscribeModel(model)) {
    return {
      text: await transcribeWithInteractions(client, model, audio, opts.lang, opts.vocabulary),
      provider: 'gemini',
      model,
      durationSeconds: opts.durationSeconds,
    };
  }
  // General Gemini models (e.g. --model gemini-3.5-flash-lite): prompt-based transcription.
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
    const client = geminiClient(apiKey);
    await client.models.generateContent({
      model: geminiTextModel(),
      contents: 'Reply {"ok":true} as JSON only.',
      config: { responseMimeType: 'application/json', maxOutputTokens: 16 },
    });
  },

  async transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
    const client = geminiClient(apiKey);
    const model = opts.model?.trim() || defaultModel();
    const audio = await uploadAudio(client, opts);
    try {
      return await transcribeUploaded(client, model, audio, opts);
    } finally {
      // Privacy: the Files API keeps uploads for 48 h. Delete ours as soon as the transcript is back.
      await client.files.delete({ name: audio.name }).catch(() => undefined);
    }
  },

  async chunkAndTranscribe(
    apiKey: string,
    chunkPaths: string[],
    mimeType: string,
    lang?: string,
    model?: string,
    vocabulary?: string[]
  ): Promise<Transcript> {
    const parts: string[] = [];
    for (const p of chunkPaths) {
      const t = await geminiProvider.transcribeFile(apiKey, { localPath: p, mimeType, lang, model, vocabulary });
      parts.push(t.text);
    }
    return {
      text: parts.join('\n'),
      provider: 'gemini',
      model: model?.trim() || defaultModel(),
    };
  },
};
