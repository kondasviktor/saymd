import { resolveGeminiKey, resolveGroqKey, resolveOpenaiKey, type SaymdConfig } from '../config.js';
import type { SttProviderId } from '../providers/types.js';
import { geminiCompiler } from './gemini.js';
import { groqCompiler, openaiCompiler } from './openai.js';
import type { CompilerProviderId, PromptCompiler } from './types.js';

export type { CompilerProviderId, PromptCompiler, StructuredResult, StructureOptions } from './types.js';

const COMPILERS: Record<CompilerProviderId, PromptCompiler> = {
  gemini: geminiCompiler,
  openai: openaiCompiler,
  groq: groqCompiler,
};

export function getCompiler(id: CompilerProviderId): PromptCompiler {
  return COMPILERS[id];
}

/**
 * Pick compiler: same provider when the STT provider also has an LLM (gemini, openai, groq);
 * otherwise prefer a Gemini key, then OpenAI, then Groq.
 */
export function resolveCompilerProvider(
  sttProvider: SttProviderId,
  config: SaymdConfig
): CompilerProviderId {
  if (sttProvider === 'gemini' || sttProvider === 'openai' || sttProvider === 'groq') return sttProvider;
  if (resolveGeminiKey(config)) return 'gemini';
  if (resolveOpenaiKey(config)) return 'openai';
  if (resolveGroqKey(config)) return 'groq';
  throw new Error(
    'Deepgram and ElevenLabs are STT-only. Add a Gemini, OpenAI or Groq key for prompt structuring:\n  saymd setup'
  );
}

export function resolveCompilerApiKey(
  compilerProvider: CompilerProviderId,
  config: SaymdConfig
): string | undefined {
  switch (compilerProvider) {
    case 'gemini':
      return resolveGeminiKey(config);
    case 'openai':
      return resolveOpenaiKey(config);
    case 'groq':
      return resolveGroqKey(config);
  }
}

export function compilerKeyEnvName(compilerProvider: CompilerProviderId): string {
  return `${compilerProvider.toUpperCase()}_API_KEY`;
}

export async function structureTranscript(
  sttProvider: SttProviderId,
  config: SaymdConfig,
  opts: Omit<import('./types.js').StructureOptions, 'apiKey'>
): Promise<import('./types.js').StructuredResult> {
  const compilerProvider = resolveCompilerProvider(sttProvider, config);
  const apiKey = resolveCompilerApiKey(compilerProvider, config);
  if (!apiKey) {
    throw new Error(`${compilerKeyEnvName(compilerProvider)} not set. Run: saymd setup`);
  }
  const compiler = getCompiler(compilerProvider);
  return compiler.structureTranscript({ ...opts, apiKey });
}
