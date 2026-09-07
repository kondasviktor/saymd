import { GoogleGenAI } from '@google/genai';

import { structureSchemaHint } from '../templates.js';
import { sectionsSchema } from '../types.js';
import { freeCompilerRules, freeCompilerReminder } from './rules.js';
import type { PromptCompiler, StructureOptions } from './types.js';

const ENRICH_MODEL = process.env.GEMINI_ENRICH_MODEL ?? 'gemini-3.5-flash-lite';

async function generateJson(client: GoogleGenAI, prompt: string): Promise<string> {
  const response = await client.models.generateContent({
    model: ENRICH_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  const text = response.text?.trim();
  if (!text) throw new Error('Empty JSON from Gemini.');
  return text;
}

async function parseStructureJson(
  rawJson: string,
  client: GoogleGenAI
): Promise<{ language: string; clean: string; sections: ReturnType<typeof sectionsSchema.parse> }> {
  try {
    const parsed = JSON.parse(rawJson) as {
      language?: string;
      clean?: string;
      sections?: unknown;
    };
    return {
      language: parsed.language ?? 'und',
      clean: parsed.clean ?? '',
      sections: sectionsSchema.parse(parsed.sections ?? {}),
    };
  } catch {
    const repair = await generateJson(
      client,
      `Fix this JSON to match the saymd schema (language, clean, sections):\n${rawJson}`
    );
    const parsed = JSON.parse(repair) as {
      language?: string;
      clean?: string;
      sections?: unknown;
    };
    return {
      language: parsed.language ?? 'und',
      clean: parsed.clean ?? '',
      sections: sectionsSchema.parse(parsed.sections ?? {}),
    };
  }
}

function buildPrompt(opts: StructureOptions): string {
  const extra = opts.proAddendum?.trim() ? `\n${opts.proAddendum.trim()}\n` : '';

  return `You are saymd — speech to agent-ready prompt spec.

${freeCompilerRules()}
${extra}
Transcript:
"""
${opts.raw}
"""

${freeCompilerReminder()}

${structureSchemaHint(opts.template)}`;
}

export const geminiCompiler: PromptCompiler = {
  id: 'gemini',

  async structureTranscript(opts: StructureOptions) {
    const client = new GoogleGenAI({ apiKey: opts.apiKey });
    const rawJson = await generateJson(client, buildPrompt(opts));
    return parseStructureJson(rawJson, client);
  },
};
