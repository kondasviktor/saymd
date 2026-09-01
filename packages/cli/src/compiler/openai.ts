import { structureSchemaHint } from '../templates.js';
import { sectionsSchema } from '../types.js';
import type { PromptCompiler, StructureOptions } from './types.js';

const ENRICH_MODEL = process.env.OPENAI_ENRICH_MODEL ?? 'gpt-4o-mini';

function openaiBaseUrl(): string {
  const base = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  return base.replace(/\/$/, '');
}

async function chatJson(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(`${openaiBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ENRICH_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI structuring failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty JSON from OpenAI.');
  return text;
}

function buildPrompt(opts: StructureOptions): string {
  const vocab =
    opts.vocab.length > 0 ? `Preserve spelling: ${opts.vocab.join(', ')}.` : '';
  const outLang =
    opts.outLang && opts.outLang !== 'same'
      ? `Write all section text in ${opts.outLang}.`
      : 'Write section text in the same language as the transcript.';

  return `You are saymd — speech to agent-ready prompt spec.

${outLang}
${vocab}
Smart cleanup: remove filler words and false starts while preserving meaning.

Transcript:
"""
${opts.raw}
"""

${structureSchemaHint(opts.template)}`;
}

async function parseStructureJson(
  apiKey: string,
  rawJson: string
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
    const repair = await chatJson(
      apiKey,
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

export const openaiCompiler: PromptCompiler = {
  id: 'openai',

  async structureTranscript(opts: StructureOptions) {
    const rawJson = await chatJson(opts.apiKey, buildPrompt(opts));
    return parseStructureJson(opts.apiKey, rawJson);
  },
};
