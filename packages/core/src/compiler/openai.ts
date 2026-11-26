import { structureSchemaHint } from '../templates.js';
import { sectionsSchema } from '../types.js';
import { freeCompilerRules, freeCompilerReminder } from './rules.js';
import type { PromptCompiler, StructureOptions } from './types.js';

import { openaiBaseUrl } from '../providers/openai.js';
import { groqBaseUrl } from '../providers/groq.js';
import { openrouterBaseUrl, openrouterProviderPrefs } from '../providers/openrouter.js';
import { trimSlash } from '../providers/openai-compatible.js';
import type { CompilerProviderId } from './types.js';

export interface OpenAiCompatibleCompilerConfig {
  id: CompilerProviderId;
  displayName: string;
  baseUrl: () => string;
  model: () => string;
  /** Extra request body fields for a given model (e.g. reasoning_effort). */
  extraBody?: (model: string) => Record<string, unknown>;
}

type ChatJson = (apiKey: string, prompt: string) => Promise<string>;

function makeChatJson(cfg: OpenAiCompatibleCompilerConfig): ChatJson {
  return async (apiKey, prompt) => {
    const model = cfg.model();
    const res = await fetch(`${trimSlash(cfg.baseUrl())}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        ...(cfg.extraBody?.(model) ?? {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${cfg.displayName} structuring failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`Empty JSON from ${cfg.displayName}.`);
    return text;
  };
}

function buildPrompt(opts: StructureOptions): string {
  const extra = opts.proAddendum?.trim() ? `${opts.proAddendum.trim()}\n\n` : '';

  return `You are saymd — speech to agent-ready prompt spec.

${extra}${freeCompilerRules()}

Transcript:
"""
${opts.raw}
"""

${freeCompilerReminder()}

${structureSchemaHint(opts.template)}`;
}

async function parseStructureJson(
  chatJson: ChatJson,
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

/** Structurer for any OpenAI-compatible `/chat/completions` API with JSON mode. */
export function createOpenAiCompatibleCompiler(cfg: OpenAiCompatibleCompilerConfig): PromptCompiler {
  const chatJson = makeChatJson(cfg);
  return {
    id: cfg.id,
    generateJson: chatJson,
    async structureTranscript(opts: StructureOptions) {
      const rawJson = await chatJson(opts.apiKey, buildPrompt(opts));
      return parseStructureJson(chatJson, opts.apiKey, rawJson);
    },
  };
}

export const openaiCompiler = createOpenAiCompatibleCompiler({
  id: 'openai',
  displayName: 'OpenAI',
  baseUrl: openaiBaseUrl,
  model: () => process.env.OPENAI_ENRICH_MODEL?.trim() || 'gpt-4o-mini',
});

/** Default Groq structurer. Free tier, rate-limited; override with GROQ_STRUCTURE_MODEL. */
export const GROQ_DEFAULT_STRUCTURE_MODEL = 'openai/gpt-oss-120b';

export const groqCompiler = createOpenAiCompatibleCompiler({
  id: 'groq',
  displayName: 'Groq',
  baseUrl: groqBaseUrl,
  model: () => process.env.GROQ_STRUCTURE_MODEL?.trim() || GROQ_DEFAULT_STRUCTURE_MODEL,
  // gpt-oss is a reasoning model; low effort keeps latency and free-tier tokens down.
  extraBody: (model) => (model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
});

/** OpenRouter structurer: Gemini 3.1 Flash-Lite by default (OPENROUTER_STRUCTURE_MODEL overrides). */
export const OPENROUTER_DEFAULT_STRUCTURE_MODEL = 'google/gemini-3.1-flash-lite';

export const openrouterCompiler = createOpenAiCompatibleCompiler({
  id: 'openrouter',
  displayName: 'OpenRouter',
  baseUrl: openrouterBaseUrl,
  model: () => process.env.OPENROUTER_STRUCTURE_MODEL?.trim() || OPENROUTER_DEFAULT_STRUCTURE_MODEL,
  extraBody: () => openrouterProviderPrefs(),
});
